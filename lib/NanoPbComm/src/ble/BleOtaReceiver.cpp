/* Copyright 2022 Vincent Stragier */
#include "BleOtaReceiver.h"
#include <cstring>
#include <esp_log.h>
#include <string>

bool BleOtaReceiver::begin(NimBLEServer *server) {
    _server = server;
    NimBLEService *service = server->createService(gm_ble_ota::SERVICE_UUID);
    if (service == nullptr)
        return false;

    NimBLECharacteristic *rxChar =
        service->createCharacteristic(gm_ble_ota::RX_CHAR_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
    if (rxChar == nullptr)
        return false;
    rxChar->setCallbacks(this);

    _txChar = service->createCharacteristic(gm_ble_ota::TX_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);
    if (_txChar == nullptr)
        return false;

    service->start();
    return true;
}

bool BleOtaReceiver::connected() const { return _server != nullptr && _server->getConnectedCount() > 0; }

void BleOtaReceiver::notify(const uint8_t *value, size_t size) {
    if (_txChar == nullptr)
        return;
    _txChar->setValue(value, size);
    _txChar->notify();
}

bool BleOtaReceiver::beginUpdate() {
    if (_finishing) {
        ESP_LOGW(LOG_TAG, "Previous update is still being finalized");
        return false;
    }
    if (_otaHandle != 0) {
        esp_ota_abort(_otaHandle);
        _otaHandle = 0;
    }
    _otaPartition = esp_ota_get_next_update_partition(nullptr);
    if (_otaPartition == nullptr) {
        abortUpdate("No OTA partition");
        return false;
    }
    if (_expectedSize == 0 || _expectedSize > _otaPartition->size || _packetSize == 0 || _parts == 0) {
        abortUpdate("Invalid update parameters");
        return false;
    }
    // Erase as we go: an upfront erase of the whole image would stall the BLE host task for seconds.
    esp_err_t err = esp_ota_begin(_otaPartition, OTA_WITH_SEQUENTIAL_WRITES, &_otaHandle);
    if (err != ESP_OK) {
        _otaHandle = 0;
        ESP_LOGE(LOG_TAG, "esp_ota_begin failed: %s", esp_err_to_name(err));
        abortUpdate("esp_ota_begin failed");
        return false;
    }
    _receivedSize = 0;
    _nextPart = 0;
    _updating = true;
    ESP_LOGI(LOG_TAG, "Receiving %u bytes in %u parts into %s", static_cast<unsigned>(_expectedSize), _parts,
             _otaPartition->label);
    return true;
}

bool BleOtaReceiver::writePart(uint16_t length, uint16_t part) {
    if (_otaHandle == 0) {
        abortUpdate("No update in progress");
        return false;
    }
    if (part != _nextPart || length > PART_BUFFER_SIZE || _receivedSize + length > _expectedSize) {
        ESP_LOGE(LOG_TAG, "Unexpected part %u (want %u), length %u", part, _nextPart, length);
        abortUpdate("Unexpected part");
        return false;
    }
    esp_err_t err = esp_ota_write(_otaHandle, _partBuffer, length);
    if (err != ESP_OK) {
        ESP_LOGE(LOG_TAG, "esp_ota_write failed: %s", esp_err_to_name(err));
        abortUpdate("esp_ota_write failed");
        return false;
    }
    _receivedSize += length;
    _nextPart++;
    ESP_LOGI(LOG_TAG, "Upload progress: %u/%u", _nextPart, _parts);
    return true;
}

void BleOtaReceiver::abortUpdate(const char *reason) {
    ESP_LOGE(LOG_TAG, "Update aborted: %s", reason);
    if (_otaHandle != 0) {
        esp_ota_abort(_otaHandle);
        _otaHandle = 0;
    }
    _updating = false;
    if (connected()) {
        const std::string message = std::string(1, static_cast<char>(0x0F)) + reason;
        notify(reinterpret_cast<const uint8_t *>(message.data()), message.size());
    }
}

void BleOtaReceiver::notifyProgress(uint8_t signal, uint16_t part) {
    const uint8_t progression[] = {signal, static_cast<uint8_t>(part / 256), static_cast<uint8_t>(part % 256)};
    notify(progression, sizeof(progression));
}

// Image verification hashes the whole partition; run it off the BLE host task, then reboot into the new image.
void BleOtaReceiver::finishTask(void *arg) {
    auto *self = static_cast<BleOtaReceiver *>(arg);
    esp_err_t err = esp_ota_end(self->_otaHandle); // frees the handle whatever the result
    self->_otaHandle = 0;
    if (err == ESP_OK)
        err = esp_ota_set_boot_partition(self->_otaPartition);
    if (err != ESP_OK) {
        ESP_LOGE(LOG_TAG, "Finalizing the update failed: %s", esp_err_to_name(err));
        self->abortUpdate("Image verification failed");
        self->_finishing = false;
        vTaskDelete(nullptr);
        return;
    }
    ESP_LOGI(LOG_TAG, "Update installed to %s, rebooting", self->_otaPartition->label);
    self->notifyProgress(0xF2, self->_parts);
    vTaskDelay(pdMS_TO_TICKS(RESTART_DELAY_MS));
    esp_restart();
}

void BleOtaReceiver::onDisconnect() {
    if (_otaHandle != 0 && !_finishing)
        abortUpdate("Disconnected");
}

void BleOtaReceiver::onWrite(NimBLECharacteristic *characteristic) {
    std::string value = characteristic->getValue();
    const size_t len = value.length();
    const auto *data = reinterpret_cast<const uint8_t *>(value.data());
    if (len == 0)
        return;

    switch (data[0]) {
    // Packet of the current part, buffered until 0xFC
    case 0xFB: {
        // After an abort the rest of the part is dropped quietly; the next 0xFC reports the failure again.
        if (len < 2 || _otaHandle == 0)
            break;
        const uint32_t offset = static_cast<uint32_t>(data[1]) * _packetSize;
        if (offset + (len - 2) > PART_BUFFER_SIZE) {
            abortUpdate("Packet out of bounds");
            break;
        }
        memcpy(_partBuffer + offset, data + 2, len - 2);
    } break;

    // Flash the buffered part; the write response is only sent once this returns, which paces the sender
    case 0xFC: {
        if (len < 5)
            break;
        const uint16_t length = (data[1] * 256) + data[2];
        const uint16_t part = (data[3] * 256) + data[4];
        if (!writePart(length, part))
            break;
        if (_nextPart < _parts) {
            // Fast-mode senders ignore this, but displays without fast mode wait for it.
            notifyProgress(0xF1, _nextPart);
        } else if (_receivedSize != _expectedSize) {
            ESP_LOGE(LOG_TAG, "Size mismatch: expected %u, received %u", static_cast<unsigned>(_expectedSize),
                     static_cast<unsigned>(_receivedSize));
            abortUpdate("Size mismatch");
        } else {
            _finishing = true;
            if (xTaskCreate(finishTask, "ota_finish", FINISH_TASK_STACK, this, 5, nullptr) != pdPASS) {
                _finishing = false;
                abortUpdate("Could not start finalizing");
            }
        }
    } break;

    // Open the update partition and report the transfer mode (fast: no 0xF1 needed between parts)
    case 0xFD: {
        if (!beginUpdate())
            break;
        const uint8_t mode[] = {0xAA, 1};
        notify(mode, sizeof(mode));
    } break;

    // Total file size
    case 0xFE:
        if (len < 5)
            break;
        _expectedSize = (static_cast<uint32_t>(data[1]) << 24) | (static_cast<uint32_t>(data[2]) << 16) |
                        (static_cast<uint32_t>(data[3]) << 8) | data[4];
        ESP_LOGI(LOG_TAG, "Expecting %u bytes", static_cast<unsigned>(_expectedSize));
        break;

    // Part count and packet size
    case 0xFF:
        if (len < 5)
            break;
        _updating = true;
        _parts = (data[1] * 256) + data[2];
        _packetSize = (data[3] * 256) + data[4];
        break;

    default:
        ESP_LOGW(LOG_TAG, "Unknown command: %02X", data[0]);
        break;
    }
}
