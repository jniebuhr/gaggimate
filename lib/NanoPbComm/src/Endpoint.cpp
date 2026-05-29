#include "Endpoint.h"
#include <cstring>
#include <esp_log.h>
#include <pb_decode.h>
#include <pb_encode.h>

static const char *ENDPOINT_TAG = "Endpoint";

Endpoint::Endpoint(Transport &transport) : _transport(transport) { _mutex = xSemaphoreCreateRecursiveMutex(); }

Endpoint::~Endpoint() {
    if (_mutex)
        vSemaphoreDelete(_mutex);
}

void Endpoint::begin() {
    _transport.onData([this](const uint8_t *data, size_t length) { handleData(data, length); });
    _transport.onConnectionChange([this](bool connected) { handleConnection(connected); });
}

void Endpoint::loop() { pump(); }

void Endpoint::on(pb_size_t which, Handler handler) {
    if (which < HANDLER_SLOTS)
        _handlers[which] = std::move(handler);
}

void Endpoint::send(const gm::Payload &payload) { send(payload, gm_proto::defaultPriority(payload.which_content)); }

void Endpoint::send(const gm::Payload &payload, uint8_t priority) {
    lock();
    _queue.upsert(gm_proto::coalescingKey(payload), priority, payload);
    unlock();
    pump();
}

void Endpoint::sendBatch(const gm::Payload *payloads, size_t count) {
    if (payloads == nullptr || count == 0)
        return;
    lock();
    for (size_t i = 0; i < count; i++)
        _queue.upsert(gm_proto::coalescingKey(payloads[i]), gm_proto::defaultPriority(payloads[i].which_content), payloads[i]);
    unlock();
    pump();
}

bool Endpoint::encodeFrame(const gm::Frame &frame, uint8_t *buf, size_t bufSize, size_t *outLen) {
    pb_ostream_t os = pb_ostream_from_buffer(buf, bufSize);
    if (!pb_encode(&os, &gaggimate_Frame_msg, &frame))
        return false;
    *outLen = os.bytes_written;
    return true;
}

void Endpoint::sendAck(uint32_t id) {
    gm::Frame frame = gaggimate_Frame_init_zero;
    frame.id = 0; // ACKs are never themselves acknowledged
    frame.ack = id;
    frame.payloads_count = 0;
    uint8_t buf[16];
    size_t len = 0;
    if (encodeFrame(frame, buf, sizeof(buf), &len))
        _transport.send(buf, len);
}

void Endpoint::pump() {
    if (!_transport.isConnected())
        return;

    lock();
    const unsigned long now = millis();

    if (_inFlight) {
        if (now - _sentAt < ACK_TIMEOUT_MS) {
            unlock();
            return; // still waiting for ACK
        }
        if (_retries >= MAX_RETRIES) {
            // Give up; coalesced fresh values (or the next periodic update) will
            // resend. The in-flight slot frees up for new traffic.
            _inFlight = false;
        } else {
            _transport.send(_txBuf, _txLen);
            _sentAt = now;
            _retries++;
            unlock();
            return;
        }
    }

    // Idle: drain the highest-priority entries into one frame.
    if (_queue.empty()) {
        unlock();
        return;
    }

    memset(&_txFrame, 0, sizeof(_txFrame));
    pb_size_t count = 0;
    while (count < MAX_PAYLOADS_PER_FRAME) {
        auto entry = _queue.pop();
        if (!entry)
            break;
        _txFrame.payloads[count++] = entry->payload;
    }
    _txFrame.payloads_count = count;
    _txFrame.ack = 0;
    _txFrame.id = _nextId++;
    if (_nextId == 0)
        _nextId = 1;

    if (!encodeFrame(_txFrame, _txBuf, BUFFER_SIZE, &_txLen)) {
        ESP_LOGE(ENDPOINT_TAG, "Failed to encode outbound frame (%u payloads)", count);
        unlock();
        return;
    }

    _transport.send(_txBuf, _txLen);
    _inFlight = true;
    _inFlightId = _txFrame.id;
    _sentAt = now;
    _retries = 0;
    unlock();
}

void Endpoint::handleData(const uint8_t *data, size_t length) {
    memset(&_rxFrame, 0, sizeof(_rxFrame));
    pb_istream_t is = pb_istream_from_buffer(data, length);
    if (!pb_decode(&is, &gaggimate_Frame_msg, &_rxFrame)) {
        ESP_LOGW(ENDPOINT_TAG, "Failed to decode frame (%u bytes): %s", static_cast<unsigned>(length), PB_GET_ERROR(&is));
        return;
    }

    const uint32_t id = _rxFrame.id;
    const uint32_t ack = _rxFrame.ack;

    bool duplicate = false;
    lock();
    if (ack != 0 && _inFlight && ack == _inFlightId)
        _inFlight = false;
    if (id != 0) {
        if (id <= _lastRxId)
            duplicate = true; // retransmit of an already-processed frame
        else
            _lastRxId = id;
    }
    unlock();

    if (id != 0 && duplicate) {
        sendAck(id); // peer's previous ACK was lost; re-ack without re-processing
        return;
    }

    // Dispatch each payload by oneof tag to its typed handler.
    for (pb_size_t i = 0; i < _rxFrame.payloads_count; i++) {
        const gm::Payload &payload = _rxFrame.payloads[i];
        const pb_size_t which = payload.which_content;
        if (which < HANDLER_SLOTS && _handlers[which])
            _handlers[which](payload);
    }

    if (id != 0)
        sendAck(id);

    // A received ACK may have freed the in-flight slot; send the next frame now.
    pump();
}

void Endpoint::handleConnection(bool connected) {
    lock();
    _inFlight = false;
    _retries = 0;
    _txLen = 0;
    _inFlightId = 0;
    _lastRxId = 0;
    _nextId = 1;
    _queue.clear();
    unlock();

    if (_connHandler)
        _connHandler(connected); // e.g. push SystemInfo on connect
}
