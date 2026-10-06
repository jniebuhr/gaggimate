/* Copyright 2022 Vincent Stragier */
// Highly inspired by https://github.com/fbiego/ESP32_BLE_OTA_Arduino
#pragma once
#ifndef SRC_BLE_OTA_DFU_HPP_
#define SRC_BLE_OTA_DFU_HPP_

#include "./freertos_utils.hpp"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_ota_ops.h>
#include <string>

constexpr char SERVICE_OTA_BLE_UUID[] = "fe590001-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_RX[] = "fe590002-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_TX[] = "fe590003-54ae-4a28-9f74-dfccb248601d";

constexpr uint32_t UPDATER_SIZE = 20000;
constexpr uint32_t OTA_FINISH_STACK = 6144;
constexpr uint32_t OTA_RESTART_DELAY_MS = 3000;

class BLE_OTA_DFU;

// Streams each received part straight into the inactive app partition; no file system staging.
class BLEOverTheAirDeviceFirmwareUpdate final : public BLECharacteristicCallbacks {
  private:
    uint8_t updater[UPDATER_SIZE]{};
    uint16_t parts = 0, MTU = 0;
    uint16_t next_part = 0;
    uint32_t received_file_size = 0;
    uint32_t expected_file_size = 0;
    esp_ota_handle_t ota_handle = 0;
    const esp_partition_t *ota_partition = nullptr;
    volatile bool finishing = false;

    bool begin_update();
    bool write_part(uint16_t length, uint16_t part);
    void abort_update(const char *reason);
    void notify_progress(uint8_t signal, uint16_t part);
    static void task_finish_update(void *parameters);

  public:
    friend class BLE_OTA_DFU;
    BLE_OTA_DFU *OTA_DFU_BLE;

    void onWrite(BLECharacteristic *pCharacteristic) override;
    void onDisconnect();
};

class BLE_OTA_DFU {
  private:
    BLEServer *pServer = nullptr;
    BLEService *pServiceOTA = nullptr;
    BLECharacteristic *pCharacteristic_BLE_OTA_DFU_TX = nullptr;
    BLEOverTheAirDeviceFirmwareUpdate *callbacks = nullptr;
    friend class BLEOverTheAirDeviceFirmwareUpdate;
    volatile bool updating = false; // written from the NimBLE task, read from the controller loop

  public:
    BLE_OTA_DFU() = default;
    ~BLE_OTA_DFU() = default;

    bool configure_OTA(NimBLEServer *pServer);
    bool begin(String local_name);

    bool connected();
    bool isUpdating() const;
    void setUpdating(bool updating);
    // Drop a half-received update when the link goes away.
    void onDisconnect();

    void send_OTA_DFU(uint8_t value);
    void send_OTA_DFU(uint8_t *value, size_t size);
    void send_OTA_DFU(String value);
};

#endif /* SRC_BLE_OTA_DFU_HPP_ */
