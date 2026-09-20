#include "Endpoint.h"
#include <cstring>
#include <esp_log.h>
#include <pb_decode.h>
#include <pb_encode.h>

static const char *ENDPOINT_TAG = "Endpoint";

Endpoint::Endpoint(Transport &transport) : _transport(transport) {
    _mutex = xSemaphoreCreateRecursiveMutex();
    _rxQueue = xQueueCreate(RX_QUEUE_DEPTH, sizeof(DispatchEvent));
    if (_mutex == nullptr || _rxQueue == nullptr)
        ESP_LOGE(ENDPOINT_TAG, "Failed to allocate endpoint resources (out of memory)");
}

Endpoint::~Endpoint() {
    // Detach first so the transport can't invoke our (this-capturing) callbacks
    // while/after we tear down the task, queue, and mutex.
    _transport.onData(nullptr);
    _transport.onConnectionChange(nullptr);
    if (_dispatchTask)
        vTaskDelete(_dispatchTask);
    if (_rxQueue)
        vQueueDelete(_rxQueue);
    if (_mutex)
        vSemaphoreDelete(_mutex);
}

void Endpoint::begin() {
    if (_mutex == nullptr || _rxQueue == nullptr) {
        ESP_LOGE(ENDPOINT_TAG, "Endpoint resources missing; not starting (comms disabled)");
        return;
    }
    _transport.onData([this](const uint8_t *data, size_t length) { handleData(data, length); });
    _transport.onConnectionChange([this](bool connected) { handleConnection(connected); });
    if (_dispatchTask == nullptr &&
        xTaskCreate(dispatchTaskFn, "GmDispatch", DISPATCH_STACK, this, 1, &_dispatchTask) != pdPASS) {
        _dispatchTask = nullptr;
        ESP_LOGE(ENDPOINT_TAG, "Failed to create dispatch task; inbound messages will not be processed");
    }
}

void Endpoint::dispatchTaskFn(void *arg) {
    auto *self = static_cast<Endpoint *>(arg);
    DispatchEvent event;
    for (;;) {
        if (xQueueReceive(self->_rxQueue, &event, portMAX_DELAY) != pdTRUE)
            continue;
        if (event.isConnection) {
            if (self->_connHandler)
                self->_connHandler(event.connected);
        } else {
            self->dispatch(event.payload);
        }
    }
}

void Endpoint::dispatch(const gm::Payload &payload) {
    const pb_size_t which = payload.which_content;
    if (which < HANDLER_SLOTS && _handlers[which])
        _handlers[which](payload);
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
}

void Endpoint::sendBatch(const gm::Payload *payloads, size_t count) {
    if (payloads == nullptr || count == 0)
        return;
    lock();
    for (size_t i = 0; i < count; i++)
        _queue.upsert(gm_proto::coalescingKey(payloads[i]), gm_proto::defaultPriority(payloads[i].which_content), payloads[i]);
    unlock();
}

void Endpoint::sendUnreliable(const gm::Payload &payload) { sendUnreliable(&payload, 1); }

void Endpoint::sendUnreliable(const gm::Payload *payloads, size_t count) {
    if (payloads == nullptr || count == 0)
        return;
    lock();
    for (size_t i = 0; i < count; i++)
        _telemetry.upsert(gm_proto::coalescingKey(payloads[i]), gm_proto::PRIO_LOW, payloads[i]);
    unlock();
}

void Endpoint::sendStop(const gm::Payload *payloads, size_t count) {
    if (payloads == nullptr || count == 0 || count > MAX_PAYLOADS_PER_FRAME)
        return;
    lock();
    _stopFrame = gaggimate_Frame_init_zero;
    _stopFrame.payloads_count = count;
    for (size_t i = 0; i < count; i++) {
        _stopFrame.payloads[i] = payloads[i];
        _queue.invalidate(gm_proto::coalescingKey(payloads[i]));
    }
    _stopPending = true;
    unlock();
}

bool Endpoint::encodeFrame(const gm::Frame &frame, uint8_t *buf, size_t bufSize, size_t *outLen) {
    pb_ostream_t os = pb_ostream_from_buffer(buf, bufSize);
    if (!pb_encode(&os, &gaggimate_Frame_msg, &frame))
        return false;
    *outLen = os.bytes_written;
    return true;
}

void Endpoint::sendAck(uint32_t id) {
    lock();
    // The peer uses stop-and-wait; retain the newest accepted id if several
    // duplicates arrive before the sender wakes up.
    if (id > _pendingAck)
        _pendingAck = id;
    unlock();
}

void Endpoint::pump() {
    const uint32_t connectionSession = _transport.connectionSession();
    if (!_transport.isConnected())
        return;
    uint8_t buffer[BUFFER_SIZE];
    size_t length = 0;
    lock();
    const bool dropped = pumpLocked(buffer, length);
    unlock();
    // A synchronous BLE write must never hold up enqueueing, ACK reception or
    // the process mutex held by a producer. Only the sender task gets here.
    if (length > 0)
        _transport.sendForSession(buffer, length, connectionSession);
    if (dropped && _sendFailedHandler)
        _sendFailedHandler();
}

bool Endpoint::pumpLocked(uint8_t *buffer, size_t &length) {
    const unsigned long now = millis();
    bool dropped = false;
    if (_stopPending) {
        if (_inFlight) {
            // Preserve idempotent configuration, unless a newer value is queued.
            // Tare/autotune and actuator commands must not be replayed after a
            // stop: the former may already have executed, the latter are stale.
            for (pb_size_t i = 0; i < _txFrame.payloads_count; i++) {
                const auto &p = _txFrame.payloads[i];
                const auto tag = p.which_content;
                const bool config = tag == gaggimate_Payload_boiler_tag || tag == gaggimate_Payload_pid_tag ||
                                    tag == gaggimate_Payload_pump_model_tag || tag == gaggimate_Payload_pressure_scale_tag ||
                                    tag == gaggimate_Payload_led_tag;
                const auto key = gm_proto::coalescingKey(p);
                bool replacedByStop = false;
                for (pb_size_t j = 0; j < _stopFrame.payloads_count; ++j)
                    replacedByStop = replacedByStop || gm_proto::coalescingKey(_stopFrame.payloads[j]) == key;
                if (config && !replacedByStop && !_queue.contains(key))
                    _queue.upsert(key, gm_proto::defaultPriority(tag), p);
            }
        }
        _inFlight = false;
        _txFrame = _stopFrame;
        _stopPending = false;
    } else if (_inFlight) {
        if (now - _sentAt >= ACK_TIMEOUT_MS) {
            if (_retries >= MAX_RETRIES) {
                _inFlight = false;
                dropped = true;
            } else {
                memcpy(buffer, _txBuf, _txLen);
                length = _txLen;
                _sentAt = now;
                _retries++;
                return false;
            }
        }
        if (_inFlight)
            return prepareAuxiliary(buffer, length);
        _txFrame = gaggimate_Frame_init_zero;
    } else {
        _txFrame = gaggimate_Frame_init_zero;
    }

    if (_txFrame.payloads_count == 0) {
        while (_txFrame.payloads_count < MAX_PAYLOADS_PER_FRAME) {
            auto entry = _queue.pop();
            if (!entry)
                break;
            _txFrame.payloads[_txFrame.payloads_count++] = entry->payload;
        }
    }
    if (_txFrame.payloads_count == 0) {
        prepareAuxiliary(buffer, length);
        return dropped;
    }
    _txFrame.id = _nextId++;
    if (_nextId == 0)
        _nextId = 1;
    _txFrame.ack = _pendingAck;
    if (!encodeFrame(_txFrame, _txBuf, BUFFER_SIZE, &_txLen)) {
        for (pb_size_t i = 0; i < _txFrame.payloads_count; i++) {
            const auto &p = _txFrame.payloads[i];
            _queue.upsert(gm_proto::coalescingKey(p), gm_proto::defaultPriority(p.which_content), p);
        }
        return dropped;
    }
    _pendingAck = 0;
    // Publish in-flight state BEFORE I/O: an ACK may arrive during send().
    _inFlight = true;
    _inFlightId = _txFrame.id;
    _sentAt = now;
    _retries = 0;
    memcpy(buffer, _txBuf, _txLen);
    length = _txLen;
    return dropped;
}

bool Endpoint::prepareAuxiliary(uint8_t *buffer, size_t &length) {
    gm::Frame frame = gaggimate_Frame_init_zero;
    frame.ack = _pendingAck;
    // ACKs take precedence over telemetry, even while our own frame is unacknowledged.
    if (frame.ack == 0) {
        while (frame.payloads_count < MAX_PAYLOADS_PER_FRAME) {
            auto entry = _telemetry.pop();
            if (!entry)
                break;
            frame.payloads[frame.payloads_count++] = entry->payload;
        }
    }
    if ((frame.ack || frame.payloads_count) && encodeFrame(frame, buffer, BUFFER_SIZE, &length))
        _pendingAck = 0;
    return false;
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
    if (ack != 0 && _inFlight && ack == _inFlightId) {
        // Sample RTT only when the frame was ACKed without a retransmit -- after
        // a retransmit we can't tell which copy this ACK answers (Karn's rule).
        if (_retries == 0) {
            const uint32_t rtt = static_cast<uint32_t>(millis() - _sentAt);
            _lastRttMs = rtt;
            _smoothedRttMs = _rttValid ? (_smoothedRttMs * 7 + rtt) / 8 : rtt;
            _rttValid = true;
        }
        _inFlight = false;
    }
    if (id != 0 && id <= _lastRxId)
        duplicate = true; // retransmit of an already-processed frame
    unlock();

    if (id != 0 && duplicate) {
        sendAck(id); // peer's previous ACK was lost; re-ack without re-processing
        return;
    }

    // Hand the payloads to the dispatch task rather than running handlers on the
    // transport (BLE) thread. Only ACK + advance the de-dup cursor once every
    // payload is safely queued; otherwise leave the frame un-ACKed so the sender
    // retransmits once the dispatch task has caught up (back-pressure).
    bool accepted = true;
    const pb_size_t n = _rxFrame.payloads_count;
    if (n > 0) {
        if (static_cast<pb_size_t>(uxQueueSpacesAvailable(_rxQueue)) < n) {
            accepted = false;
        } else {
            for (pb_size_t i = 0; i < n; i++) {
                DispatchEvent event;
                event.payload = _rxFrame.payloads[i];
                xQueueSend(_rxQueue, &event, 0);
            }
        }
    }

    if (accepted) {
        if (id != 0) {
            lock();
            _lastRxId = id;
            unlock();
            sendAck(id);
        }
    }

    // The sender task observes the freed slot on its next pass.
}

void Endpoint::handleConnection(bool connected) {
    lock();
    _inFlight = false;
    _retries = 0;
    _txLen = 0;
    _inFlightId = 0;
    _lastRxId = 0;
    _nextId = 1;
    _rttValid = false; // latency is per-link; don't carry a stale estimate across reconnects
    _smoothedRttMs = 0;
    _lastRttMs = 0;
    _queue.clear();
    _telemetry.clear();
    _stopPending = false;
    _pendingAck = 0;
    unlock();

    if (_rxQueue) {
        // Drop queued payloads from the previous session, then serialize the
        // application connection callback with payload dispatch. A payload
        // already executing finishes before this event, so it cannot mutate
        // per-session application state after the callback resets it.
        xQueueReset(_rxQueue);
        DispatchEvent event;
        event.isConnection = true;
        event.connected = connected;
        xQueueSend(_rxQueue, &event, 0);
    }
}
