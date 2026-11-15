#include "UartTransport.h"
#include <cstring>
#include <esp_log.h>

UartTransport::~UartTransport() {
    // Detach before tearing down so a stray loop() can't call back into us.
    onData(nullptr);
    onConnectionChange(nullptr);
    for (auto &cb : _channelCbs)
        cb = nullptr;
    if (_txMutex)
        vSemaphoreDelete(_txMutex);
}

void UartTransport::begin() {
    if (_txMutex == nullptr) {
        _txMutex = xSemaphoreCreateMutex();
        if (_txMutex == nullptr)
            ESP_LOGE(LOG_TAG, "Failed to allocate TX mutex; sends will be unsynchronised");
    }
    _rxLen = 0;
    _rxOverflow = false;
    _connected = false;
    _hearing = false;
    _peerHears = false;
    _keepaliveDue = false;
    _muted = false;
    const unsigned long now = millis();
    _lastRxMs = now;
    _lastKeepaliveMs = now;
}

void UartTransport::onChannelData(Channel channel, DataCallback cb) {
    if (channel != CHANNEL_PROTOCOL && channel < CHANNEL_COUNT)
        _channelCbs[channel] = std::move(cb);
}

void UartTransport::disconnect() {
    _mutedAt = millis();
    _muted = true;
    ESP_LOGW(LOG_TAG, "Muting link for %lu ms", DISCONNECT_HOLD_MS);
}

void UartTransport::loop() {
    // Only drain what's already buffered, so a chatty peer can't pin us here.
    int pending = _stream.available();
    for (int i = 0; i < pending; i++) {
        const int byte = _stream.read();
        if (byte < 0)
            break;
        processByte(static_cast<uint8_t>(byte));
    }

    const unsigned long now = millis();
    if (_dropped > 0 && now - _lastDropLogMs >= DROP_LOG_INTERVAL_MS) {
        ESP_LOGW(LOG_TAG, "Dropped %u invalid frames", static_cast<unsigned>(_dropped));
        _dropped = 0;
        _lastDropLogMs = now;
    }
    if (_muted) {
        dropLink();
        if (now - _mutedAt < DISCONNECT_HOLD_MS)
            return;
        _muted = false;
        _lastRxMs = now;
    }
    if (_hearing && now - _lastRxMs > LINK_TIMEOUT_MS)
        dropLink();

    // Not gated on _connected -- see the header for why.
    const unsigned long interval = _connected ? KEEPALIVE_INTERVAL_MS : KEEPALIVE_SEARCH_INTERVAL_MS;
    if (_keepaliveDue || now - _lastKeepaliveMs >= interval)
        sendKeepalive();
}

// One flag byte and no channel: tells the peer whether we hear it, so a one-way wire never counts as a link.
void UartTransport::sendKeepalive() {
    _lastKeepaliveMs = millis();
    _keepaliveDue = false;
    const uint8_t flags = _hearing ? KEEPALIVE_HEARS_PEER : 0;
    writeFrame(&flags, 1, nullptr, 0);
}

void UartTransport::dropLink() {
    _hearing = false;
    _peerHears = false;
    setConnected(false);
}

bool UartTransport::sendOn(Channel channel, const uint8_t *data, size_t length) {
    if (_muted || channel >= CHANNEL_COUNT || data == nullptr || length == 0 || length > MAX_DATAGRAM)
        return false;
    const uint8_t header = channel;
    return writeFrame(&header, CHANNEL_LEN, data, length);
}

bool UartTransport::writeFrame(const uint8_t *header, size_t headerLen, const uint8_t *data, size_t length) {
    if (headerLen + length + CRC_LEN > DECODE_CAP)
        return false;

    lockTx();
    if (headerLen > 0)
        memcpy(_txStage, header, headerLen);
    if (length > 0)
        memcpy(_txStage + headerLen, data, length);
    const size_t bodyLen = headerLen + length;
    const uint16_t crc = gm_uart::crc16(_txStage, bodyLen);
    _txStage[bodyLen] = static_cast<uint8_t>(crc & 0xFF);
    _txStage[bodyLen + 1] = static_cast<uint8_t>(crc >> 8);

    size_t encLen = gm_uart::cobsEncode(_txStage, bodyLen + CRC_LEN, _txEncoded);
    _txEncoded[encLen++] = 0x00;

    const size_t written = _stream.write(_txEncoded, encLen);
    unlockTx();
    return written == encLen;
}

void UartTransport::processByte(uint8_t byte) {
    if (byte == 0x00) { // end of frame
        if (!_rxOverflow && _rxLen > 0)
            handleFrame(_rxBuf, _rxLen);
        _rxLen = 0;
        _rxOverflow = false;
        return;
    }
    if (_rxLen < sizeof(_rxBuf))
        _rxBuf[_rxLen++] = byte;
    else
        _rxOverflow = true; // too big, drop the rest until the next delimiter
}

void UartTransport::handleFrame(const uint8_t *block, size_t blockLen) {
    if (_muted)
        return;
    const size_t decodedLen = gm_uart::cobsDecode(block, blockLen, _decodeBuf, sizeof(_decodeBuf));
    if (decodedLen < CRC_LEN) {
        _dropped++;
        return;
    }

    const size_t bodyLen = decodedLen - CRC_LEN;
    const uint16_t received = static_cast<uint16_t>(_decodeBuf[bodyLen]) | static_cast<uint16_t>(_decodeBuf[bodyLen + 1]) << 8;
    if (received != gm_uart::crc16(_decodeBuf, bodyLen)) {
        _dropped++;
        return;
    }

    _lastRxMs = millis();
    if (!_hearing) {
        _hearing = true;
        _keepaliveDue = true;
    }
    // Keepalives carry the peer's view; an empty one comes from a peer without the handshake, data implies it hears us.
    const bool keepalive = bodyLen <= CHANNEL_LEN;
    _peerHears = !keepalive || bodyLen == 0 || (_decodeBuf[0] & KEEPALIVE_HEARS_PEER) != 0;
    setConnected(_peerHears);
    if (keepalive)
        return;

    const uint8_t channel = _decodeBuf[0];
    const uint8_t *payload = _decodeBuf + CHANNEL_LEN;
    const size_t payloadLen = bodyLen - CHANNEL_LEN;
    if (channel == CHANNEL_PROTOCOL)
        emitData(payload, payloadLen);
    else if (channel < CHANNEL_COUNT && _channelCbs[channel])
        _channelCbs[channel](payload, payloadLen);
    else
        ESP_LOGW(LOG_TAG, "Dropping frame for unknown channel %u", channel);
}

void UartTransport::setConnected(bool connected) {
    if (_connected == connected)
        return;
    _connected = connected;
    ESP_LOGI(LOG_TAG, "%s", connected ? "Link up" : "Link down");
    emitConnection(connected);
}
