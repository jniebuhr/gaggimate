/* Copyright 2022 Vincent Stragier */
#include "ble_ota_dfu.hpp"

// Protocol: 0xFE size, 0xFF parts + packet size, 0xFD start (-> 0xAA mode), 0xFB packet, 0xFC flash part (-> 0xF1 / 0xF2).
// A failure is reported as 0x0F followed by a reason string.

bool BLEOverTheAirDeviceFirmwareUpdate::begin_update() {
    if (finishing) {
        ESP_LOGW(TAG, "Previous update is still being finalized");
        return false;
    }
    if (ota_handle != 0) {
        esp_ota_abort(ota_handle);
        ota_handle = 0;
    }
    ota_partition = esp_ota_get_next_update_partition(nullptr);
    if (ota_partition == nullptr) {
        abort_update("No OTA partition");
        return false;
    }
    if (expected_file_size == 0 || expected_file_size > ota_partition->size || MTU == 0 || parts == 0) {
        abort_update("Invalid update parameters");
        return false;
    }
    // Erase as we go: an upfront erase of the whole image would stall the BLE host task for seconds.
    esp_err_t err = esp_ota_begin(ota_partition, OTA_WITH_SEQUENTIAL_WRITES, &ota_handle);
    if (err != ESP_OK) {
        ota_handle = 0;
        ESP_LOGE(TAG, "esp_ota_begin failed: %s", esp_err_to_name(err));
        abort_update("esp_ota_begin failed");
        return false;
    }
    received_file_size = 0;
    next_part = 0;
    OTA_DFU_BLE->setUpdating(true);
    ESP_LOGI(TAG, "Receiving %u bytes in %u parts into %s", expected_file_size, parts, ota_partition->label);
    return true;
}

bool BLEOverTheAirDeviceFirmwareUpdate::write_part(uint16_t length, uint16_t part) {
    if (ota_handle == 0) {
        abort_update("No update in progress");
        return false;
    }
    if (part != next_part || length > UPDATER_SIZE || received_file_size + length > expected_file_size) {
        ESP_LOGE(TAG, "Unexpected part %u (want %u), length %u", part, next_part, length);
        abort_update("Unexpected part");
        return false;
    }
    esp_err_t err = esp_ota_write(ota_handle, updater, length);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_write failed: %s", esp_err_to_name(err));
        abort_update("esp_ota_write failed");
        return false;
    }
    received_file_size += length;
    next_part++;
    ESP_LOGI(TAG, "Upload progress: %u/%u", next_part, parts);
    return true;
}

void BLEOverTheAirDeviceFirmwareUpdate::abort_update(const char *reason) {
    ESP_LOGE(TAG, "Update aborted: %s", reason);
    if (ota_handle != 0) {
        esp_ota_abort(ota_handle);
        ota_handle = 0;
    }
    OTA_DFU_BLE->setUpdating(false);
    if (OTA_DFU_BLE->connected())
        OTA_DFU_BLE->send_OTA_DFU(String(static_cast<char>(0x0F)) + reason);
}

void BLEOverTheAirDeviceFirmwareUpdate::notify_progress(uint8_t signal, uint16_t part) {
    uint8_t progression[] = {signal, static_cast<uint8_t>(part / 256), static_cast<uint8_t>(part % 256)};
    OTA_DFU_BLE->send_OTA_DFU(progression, sizeof(progression));
}

// Image verification hashes the whole partition; run it off the BLE host task, then reboot into the new image.
void BLEOverTheAirDeviceFirmwareUpdate::task_finish_update(void *parameters) {
    auto *self = static_cast<BLEOverTheAirDeviceFirmwareUpdate *>(parameters);
    esp_err_t err = esp_ota_end(self->ota_handle); // frees the handle whatever the result
    self->ota_handle = 0;
    if (err == ESP_OK)
        err = esp_ota_set_boot_partition(self->ota_partition);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Finalizing the update failed: %s", esp_err_to_name(err));
        self->abort_update("Image verification failed");
        self->finishing = false;
        vTaskDelete(nullptr);
        return;
    }
    ESP_LOGI(TAG, "Update installed to %s, rebooting", self->ota_partition->label);
    self->notify_progress(0xF2, self->parts);
    vTaskDelay(pdMS_TO_TICKS(OTA_RESTART_DELAY_MS));
    esp_restart();
}

void BLEOverTheAirDeviceFirmwareUpdate::onDisconnect() {
    if (ota_handle != 0 && !finishing)
        abort_update("Disconnected");
}

void BLEOverTheAirDeviceFirmwareUpdate::onWrite(BLECharacteristic *pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    const size_t len = value.length();
    const auto *pData = reinterpret_cast<const uint8_t *>(value.data());
    if (len == 0)
        return;

    switch (pData[0]) {
    // Packet of the current part, buffered until 0xFC
    case 0xFB: {
        // After an abort the rest of the part is dropped quietly; the next 0xFC reports the failure again.
        if (len < 2 || ota_handle == 0)
            break;
        const uint32_t offset = static_cast<uint32_t>(pData[1]) * MTU;
        if (offset + (len - 2) > UPDATER_SIZE) {
            abort_update("Packet out of bounds");
            break;
        }
        memcpy(updater + offset, pData + 2, len - 2);
    } break;

    // Flash the buffered part; the write response is only sent once this returns, which paces the sender
    case 0xFC: {
        if (len < 5)
            break;
        const uint16_t length = (pData[1] * 256) + pData[2];
        const uint16_t part = (pData[3] * 256) + pData[4];
        if (!write_part(length, part))
            break;
        if (next_part < parts) {
            // Fast-mode senders ignore this, but displays without fast mode wait for it.
            notify_progress(0xF1, next_part);
        } else if (received_file_size != expected_file_size) {
            ESP_LOGE(TAG, "Size mismatch: expected %u, received %u", expected_file_size, received_file_size);
            abort_update("Size mismatch");
        } else {
            finishing = true;
            if (xTaskCreate(task_finish_update, "ota_finish", OTA_FINISH_STACK, this, 5, nullptr) != pdPASS) {
                finishing = false;
                abort_update("Could not start finalizing");
            }
        }
    } break;

    // Open the update partition and report the transfer mode (fast: no 0xF1 needed between parts)
    case 0xFD: {
        if (!begin_update())
            break;
        uint8_t mode[] = {0xAA, 1};
        OTA_DFU_BLE->send_OTA_DFU(mode, sizeof(mode));
    } break;

    // Total file size
    case 0xFE:
        if (len < 5)
            break;
        expected_file_size = (static_cast<uint32_t>(pData[1]) << 24) | (static_cast<uint32_t>(pData[2]) << 16) |
                             (static_cast<uint32_t>(pData[3]) << 8) | pData[4];
        ESP_LOGI(TAG, "Expecting %u bytes", expected_file_size);
        break;

    // Part count and packet size
    case 0xFF:
        if (len < 5)
            break;
        OTA_DFU_BLE->setUpdating(true);
        parts = (pData[1] * 256) + pData[2];
        MTU = (pData[3] * 256) + pData[4];
        break;

    default:
        ESP_LOGW(TAG, "Unknown command: %02X", pData[0]);
        break;
    }
}

bool BLE_OTA_DFU::configure_OTA(NimBLEServer *pServer) {
    this->pServer = pServer;
    pServiceOTA = pServer->createService(SERVICE_OTA_BLE_UUID);
    if (pServiceOTA == nullptr) {
        return false;
    }

    BLECharacteristic *pCharacteristic_BLE_OTA_DFU_RX =
        pServiceOTA->createCharacteristic(CHARACTERISTIC_OTA_BL_UUID_RX, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
    if (pCharacteristic_BLE_OTA_DFU_RX == nullptr) {
        return false;
    }

    callbacks = new BLEOverTheAirDeviceFirmwareUpdate();
    callbacks->OTA_DFU_BLE = this;
    pCharacteristic_BLE_OTA_DFU_RX->setCallbacks(callbacks);

    pCharacteristic_BLE_OTA_DFU_TX = pServiceOTA->createCharacteristic(CHARACTERISTIC_OTA_BL_UUID_TX, NIMBLE_PROPERTY::NOTIFY);
    if (pCharacteristic_BLE_OTA_DFU_TX == nullptr) {
        return false;
    }

    pServiceOTA->start();
    return true;
}

bool BLE_OTA_DFU::begin(String local_name) {
    BLEDevice::init(local_name.c_str());
    pServer = BLEDevice::createServer();
    if (pServer == nullptr) {
        return false;
    }
    if (!this->configure_OTA(pServer)) {
        return false;
    }
    pServer->getAdvertising()->addServiceUUID(pServiceOTA->getUUID());
    pServer->getAdvertising()->start();
    return true;
}

bool BLE_OTA_DFU::connected() { return pServer != nullptr && pServer->getConnectedCount() > 0; }

bool BLE_OTA_DFU::isUpdating() const { return updating; }

void BLE_OTA_DFU::setUpdating(bool updating) { this->updating = updating; }

void BLE_OTA_DFU::onDisconnect() {
    if (callbacks != nullptr)
        callbacks->onDisconnect();
}

void BLE_OTA_DFU::send_OTA_DFU(uint8_t value) {
    uint8_t _value = value;
    this->pCharacteristic_BLE_OTA_DFU_TX->setValue(&_value, 1);
    this->pCharacteristic_BLE_OTA_DFU_TX->notify();
}

void BLE_OTA_DFU::send_OTA_DFU(uint8_t *value, size_t size) {
    this->pCharacteristic_BLE_OTA_DFU_TX->setValue(value, size);
    this->pCharacteristic_BLE_OTA_DFU_TX->notify();
}

void BLE_OTA_DFU::send_OTA_DFU(String value) {
    this->pCharacteristic_BLE_OTA_DFU_TX->setValue(value.c_str());
    this->pCharacteristic_BLE_OTA_DFU_TX->notify();
}
