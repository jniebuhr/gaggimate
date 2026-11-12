#include "UartOtaReceiver.h"
#include <Update.h>
#include <cstdio>
#include <cstring>
#include <esp_log.h>

using namespace gm_uart_ota;

void UartOtaReceiver::begin() {
    if (_requests != nullptr)
        return;
    // Stop-and-wait keeps at most one request in flight; the second slot absorbs a retransmit.
    _requests = xQueueCreate(2, sizeof(Request));
    if (_requests == nullptr ||
        xTaskCreatePinnedToCore(taskFn, "UartOta", TASK_STACK, this, TASK_PRIORITY, nullptr, 0) != pdPASS) {
        ESP_LOGE(LOG_TAG, "Failed to start the OTA worker; firmware updates disabled");
        return;
    }
    _transport.onChannelData(UartTransport::CHANNEL_OTA, [this](const uint8_t *data, size_t length) { onData(data, length); });
}

void UartOtaReceiver::onData(const uint8_t *data, size_t length) {
    static Request req; // only touched from the transport's loop() thread
    if (length == 0 || length > sizeof(req.data))
        return;
    req.length = static_cast<uint16_t>(length);
    memcpy(req.data, data, length);
    if (xQueueSend(_requests, &req, 0) != pdTRUE)
        ESP_LOGW(LOG_TAG, "Worker busy, dropping request 0x%02x (sender will retry)", data[0]);
}

void UartOtaReceiver::taskFn(void *arg) {
    auto *self = static_cast<UartOtaReceiver *>(arg);
    static Request req;
    unsigned long lastActivity = millis();
    for (;;) {
        if (xQueueReceive(self->_requests, &req, pdMS_TO_TICKS(500)) == pdTRUE) {
            lastActivity = millis();
            self->handle(req);
        }
        if (self->_finished && millis() - self->_finishedAt >= REBOOT_DELAY_MS) {
            ESP_LOGI(LOG_TAG, "Rebooting into the new firmware");
            ESP.restart();
        }
        if (self->_updating && !self->_finished && millis() - lastActivity > IDLE_ABORT_MS) {
            ESP_LOGE(LOG_TAG, "No OTA traffic for %lu ms, aborting update", IDLE_ABORT_MS);
            self->abortUpdate();
        }
    }
}

void UartOtaReceiver::handle(const Request &req) {
    switch (req.data[0]) {
    case CMD_BEGIN:
        handleBegin(req.data, req.length);
        break;
    case CMD_DATA:
        handleData(req.data, req.length);
        break;
    case CMD_END:
        handleEnd();
        break;
    case CMD_ABORT:
        if (!_finished)
            abortUpdate();
        respond(CMD_ABORT, STATUS_OK, 0);
        break;
    default:
        ESP_LOGW(LOG_TAG, "Unknown OTA command 0x%02x", req.data[0]);
        break;
    }
}

void UartOtaReceiver::handleBegin(const uint8_t *data, size_t length) {
    if (length < BEGIN_LEN) {
        respond(CMD_BEGIN, STATUS_MALFORMED, 0);
        return;
    }
    if (_finished) { // already verified and about to reboot; don't tear that down
        respond(CMD_BEGIN, STATUS_BAD_STATE, 0);
        return;
    }
    if (_updating)
        abortUpdate(); // a (re)started transfer always starts from scratch

    const uint32_t size = getU32(data + 1);
    char md5Hex[MD5_LEN * 2 + 1];
    for (size_t i = 0; i < MD5_LEN; i++)
        snprintf(md5Hex + i * 2, 3, "%02x", data[5 + i]);

    ESP_LOGI(LOG_TAG, "Starting update: %u bytes, md5 %s", static_cast<unsigned>(size), md5Hex);
    if (size == 0 || !Update.begin(size, U_FLASH)) {
        ESP_LOGE(LOG_TAG, "Update.begin failed: %s", Update.errorString());
        respond(CMD_BEGIN, STATUS_BEGIN_FAILED, Update.getError());
        return;
    }
    Update.setMD5(md5Hex);
    _size = size;
    _written = 0;
    _lastChunkLen = 0;
    _updating = true;
    if (_startCb)
        _startCb();
    respond(CMD_BEGIN, STATUS_OK, 0);
}

void UartOtaReceiver::handleData(const uint8_t *data, size_t length) {
    if (!_updating || _finished) {
        respond(CMD_DATA, STATUS_BAD_STATE, 0);
        return;
    }
    if (length <= DATA_HEADER_LEN) {
        respond(CMD_DATA, STATUS_MALFORMED, _written);
        return;
    }
    const uint32_t offset = getU32(data + 1);
    const size_t chunkLen = length - DATA_HEADER_LEN;

    if (offset + chunkLen == _written && chunkLen == _lastChunkLen) {
        respond(CMD_DATA, STATUS_OK, _written); // repeat of the chunk we just wrote; its ACK got lost
        return;
    }
    if (offset != _written || offset + chunkLen > _size) {
        respond(CMD_DATA, STATUS_BAD_OFFSET, _written);
        return;
    }
    if (Update.write(const_cast<uint8_t *>(data + DATA_HEADER_LEN), chunkLen) != chunkLen) {
        ESP_LOGE(LOG_TAG, "Write failed at %u: %s", static_cast<unsigned>(offset), Update.errorString());
        const uint8_t err = Update.getError();
        abortUpdate();
        respond(CMD_DATA, STATUS_WRITE_FAILED, err);
        return;
    }
    _written += chunkLen;
    _lastChunkLen = chunkLen;
    respond(CMD_DATA, STATUS_OK, _written);
}

void UartOtaReceiver::handleEnd() {
    if (_finished) {
        respond(CMD_END, STATUS_OK, _written); // END repeated because our answer was lost
        return;
    }
    if (!_updating || _written != _size) {
        respond(CMD_END, STATUS_BAD_STATE, _written);
        return;
    }
    // Checks the MD5, validates the image and switches the boot partition.
    if (!Update.end()) {
        ESP_LOGE(LOG_TAG, "Image rejected: %s", Update.errorString());
        const uint8_t err = Update.getError();
        abortUpdate();
        respond(CMD_END, STATUS_VERIFY_FAILED, err);
        return;
    }
    ESP_LOGI(LOG_TAG, "Update verified (%u bytes)", static_cast<unsigned>(_written));
    _finished = true;
    _finishedAt = millis();
    respond(CMD_END, STATUS_OK, _written);
}

void UartOtaReceiver::abortUpdate() {
    if (Update.isRunning())
        Update.abort();
    _updating = false;
    _written = 0;
    _lastChunkLen = 0;
    _size = 0;
}

void UartOtaReceiver::respond(uint8_t cmd, uint8_t status, uint32_t value) {
    uint8_t out[RESPONSE_LEN];
    out[0] = cmd | RESPONSE_FLAG;
    out[1] = status;
    putU32(out + 2, value);
    _transport.sendOn(UartTransport::CHANNEL_OTA, out, sizeof(out));
}
