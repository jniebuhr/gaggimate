#include "UartOtaSender.h"
#include <algorithm>
#include <cstring>
#include <esp_log.h>

using namespace gm_uart_ota;

UartOtaSender::~UartOtaSender() {
    _transport.onChannelData(UartTransport::CHANNEL_OTA, nullptr);
    if (_responses)
        vQueueDelete(_responses);
}

void UartOtaSender::begin() {
    if (_responses == nullptr)
        _responses = xQueueCreate(4, sizeof(Response));
    if (_responses == nullptr) {
        ESP_LOGE(LOG_TAG, "Failed to allocate response queue; controller updates disabled");
        return;
    }
    _transport.onChannelData(UartTransport::CHANNEL_OTA, [this](const uint8_t *data, size_t length) { onData(data, length); });
}

void UartOtaSender::onData(const uint8_t *data, size_t length) {
    if (length < RESPONSE_LEN || (data[0] & RESPONSE_FLAG) == 0)
        return;
    Response r{static_cast<uint8_t>(data[0] & ~RESPONSE_FLAG), data[1], getU32(data + 2)};
    xQueueSend(_responses, &r, 0); // run() drains stale entries, so dropping on a full queue is fine
}

bool UartOtaSender::transact(const uint8_t *request, size_t length, unsigned long timeoutMs, Response &out) {
    const uint8_t cmd = request[0];
    for (uint8_t attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0)
            ESP_LOGW(LOG_TAG, "No response to 0x%02x, retry %u/%u", cmd, attempt, MAX_RETRIES);
        xQueueReset(_responses); // anything queued belongs to an earlier, already settled request
        if (!_transport.sendOn(UartTransport::CHANNEL_OTA, request, length)) {
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }
        const TickType_t deadline = xTaskGetTickCount() + pdMS_TO_TICKS(timeoutMs);
        for (;;) {
            const TickType_t now = xTaskGetTickCount();
            if (static_cast<int32_t>(deadline - now) <= 0)
                break;
            if (xQueueReceive(_responses, &out, deadline - now) != pdTRUE)
                break;
            if (out.cmd == cmd)
                return true;
        }
    }
    return false;
}

void UartOtaSender::sendAbort() {
    const uint8_t abort = CMD_ABORT;
    Response ignored{};
    transact(&abort, 1, RESPONSE_TIMEOUT_MS, ignored);
}

bool UartOtaSender::run(uint32_t size, const uint8_t md5[MD5_LEN], const ReadFn &read, const ProgressFn &progress) {
    if (_responses == nullptr || size == 0) {
        ESP_LOGE(LOG_TAG, "Not initialised or empty image");
        return false;
    }
    if (!isLinkUp()) {
        ESP_LOGE(LOG_TAG, "Controller not connected");
        return false;
    }

    Response r{};
    uint8_t beginReq[BEGIN_LEN];
    beginReq[0] = CMD_BEGIN;
    putU32(beginReq + 1, size);
    memcpy(beginReq + 5, md5, MD5_LEN);
    if (!transact(beginReq, sizeof(beginReq), RESPONSE_TIMEOUT_MS, r) || r.status != STATUS_OK) {
        ESP_LOGE(LOG_TAG, "Controller refused the update (status %u, value %u)", r.status, static_cast<unsigned>(r.value));
        return false;
    }
    ESP_LOGI(LOG_TAG, "Sending %u bytes to the controller", static_cast<unsigned>(size));

    uint32_t offset = 0;
    progress(0, size);
    while (offset < size) {
        const size_t len = std::min<size_t>(CHUNK_SIZE, size - offset);
        _txBuf[0] = CMD_DATA;
        putU32(_txBuf + 1, offset);
        if (read(offset, _txBuf + DATA_HEADER_LEN, len) != len) {
            ESP_LOGE(LOG_TAG, "Could not read image at offset %u", static_cast<unsigned>(offset));
            sendAbort();
            return false;
        }
        if (!transact(_txBuf, DATA_HEADER_LEN + len, RESPONSE_TIMEOUT_MS, r)) {
            ESP_LOGE(LOG_TAG, "Controller stopped responding at offset %u", static_cast<unsigned>(offset));
            sendAbort();
            return false;
        }
        if (r.status == STATUS_BAD_OFFSET && r.value <= size) {
            // Controller is somewhere else in the image (e.g. we missed an ACK twice); pick up where it is.
            ESP_LOGW(LOG_TAG, "Resyncing from %u to %u", static_cast<unsigned>(offset), static_cast<unsigned>(r.value));
            offset = r.value;
            continue;
        }
        if (r.status != STATUS_OK) {
            ESP_LOGE(LOG_TAG, "Write failed at offset %u (status %u, value %u)", static_cast<unsigned>(offset), r.status,
                     static_cast<unsigned>(r.value));
            sendAbort();
            return false;
        }
        offset = r.value;
        progress(offset, size);
    }

    const uint8_t endReq = CMD_END;
    if (!transact(&endReq, 1, END_TIMEOUT_MS, r)) {
        ESP_LOGE(LOG_TAG, "No response to END; controller state unknown");
        return false;
    }
    if (r.status != STATUS_OK) {
        ESP_LOGE(LOG_TAG, "Controller rejected the image (status %u, error %u)", r.status, static_cast<unsigned>(r.value));
        return false;
    }
    ESP_LOGI(LOG_TAG, "Controller verified the image and is rebooting");
    return true;
}
