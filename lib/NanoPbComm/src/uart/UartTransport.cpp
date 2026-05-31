#include "UartTransport.h"
#include <cstring>
#include <esp_log.h>

UartTransport::~UartTransport() {
    // Detach before tearing down so a stray loop() can't call back into us.
    onData(nullptr);
    onConnectionChange(nullptr);
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
    const unsigned long now = millis();
    _lastRxMs = now;
    _lastKeepaliveMs = now;
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
    if (_connected && now - _lastRxMs > LINK_TIMEOUT_MS)
        setConnected(false);

    // Not gated on _connected -- see the header for why.
    if (now - _lastKeepaliveMs >= KEEPALIVE_INTERVAL_MS) {
        _lastKeepaliveMs = now;
        writeDatagram(nullptr, 0); // empty datagram == keepalive
    }
}

bool UartTransport::send(const uint8_t *data, size_t length) {
    if (data == nullptr || length == 0 || length > MAX_DATAGRAM)
        return false; // length 0 is reserved for keepalives
    return writeDatagram(data, length);
}

bool UartTransport::writeDatagram(const uint8_t *data, size_t length) {
    if (length > MAX_DATAGRAM)
        return false;

    lockTx();
    if (length > 0)
        memcpy(_txStage, data, length);
    const uint16_t crc = gm_uart::crc16(_txStage, length);
    _txStage[length] = static_cast<uint8_t>(crc & 0xFF);
    _txStage[length + 1] = static_cast<uint8_t>(crc >> 8);

    size_t encLen = gm_uart::cobsEncode(_txStage, length + CRC_LEN, _txEncoded);
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
    const size_t decodedLen = gm_uart::cobsDecode(block, blockLen, _decodeBuf, sizeof(_decodeBuf));
    if (decodedLen < CRC_LEN) {
        ESP_LOGW(LOG_TAG, "Dropping malformed frame (%u block bytes)", static_cast<unsigned>(blockLen));
        return;
    }

    const size_t payloadLen = decodedLen - CRC_LEN;
    const uint16_t received = static_cast<uint16_t>(_decodeBuf[payloadLen]) | static_cast<uint16_t>(_decodeBuf[payloadLen + 1])
                                                                                  << 8;
    if (received != gm_uart::crc16(_decodeBuf, payloadLen)) {
        ESP_LOGW(LOG_TAG, "Dropping frame with bad CRC (%u payload bytes)", static_cast<unsigned>(payloadLen));
        return;
    }

    markAlive();
    if (payloadLen > 0)
        emitData(_decodeBuf, payloadLen); // empty == keepalive, swallow it
}

void UartTransport::markAlive() {
    _lastRxMs = millis();
    setConnected(true);
}

void UartTransport::setConnected(bool connected) {
    if (_connected == connected)
        return;
    _connected = connected;
    ESP_LOGI(LOG_TAG, "%s", connected ? "Link up" : "Link down");
    emitConnection(connected);
}
