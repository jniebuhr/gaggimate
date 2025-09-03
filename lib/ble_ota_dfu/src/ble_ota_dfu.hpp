/* Copyright 2022 Vincent Stragier */
// Highly inspired by https://github.com/fbiego/ESP32_BLE_OTA_Arduino
#pragma once
#ifndef SRC_BLE_OTA_DFU_HPP_
#define SRC_BLE_OTA_DFU_HPP_

#include "./freertos_utils.hpp"
#include <Arduino.h>
#include <FS.h>
#include <NimBLEDevice.h>
#include <Update.h>
#include <string>

// comment to use FFat
#define USE_SPIFFS

#ifdef USE_SPIFFS
// SPIFFS write is slower
#include <SPIFFS.h>
#define FLASH SPIFFS
const bool FASTMODE = false;
#else
// FFat is faster
#include <FFat.h>
#define FLASH FFat
const bool FASTMODE = true;
#endif
// #endif

constexpr char SERVICE_OTA_BLE_UUID[] = "fe590001-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_RX[] =
    "fe590002-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_TX[] =
    "fe590003-54ae-4a28-9f74-dfccb248601d";

constexpr bool FORMAT_FLASH_IF_MOUNT_FAILED = true;
constexpr uint32_t UPDATER_SIZE = 20000;

/* Dummy class */
class BLE_OTA_DFU;

class BLEOverTheAirDeviceFirmwareUpdate final : public NimBLECharacteristicCallbacks {
private:
  bool selected_updater = true;
  bool file_open = false;
  uint8_t updater[2][UPDATER_SIZE]{};
  uint16_t write_len[2] = {0, 0};
  uint16_t parts = 0, MTU = 0;
  uint16_t current_progression = 0;
  uint32_t received_file_size = 0;
  uint32_t expected_file_size = 0;

public:
  friend class BLE_OTA_DFU;
  BLE_OTA_DFU *OTA_DFU_BLE;

  uint16_t write_binary(fs::FS *file_system, const char *path, uint8_t *data,
                        uint16_t length, bool keep_open = true);
  void onWrite(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo& connInfo) override;
};

class BLE_OTA_DFU {
private:
  BLEServer *pServer = nullptr;
  BLEService *pServiceOTA = nullptr;
  BLECharacteristic *pCharacteristic_BLE_OTA_DFU_TX = nullptr;
  friend class BLEOverTheAirDeviceFirmwareUpdate;

public:
  BLE_OTA_DFU() = default;
  ~BLE_OTA_DFU() = default;

  bool configure_OTA(NimBLEServer *pServer);
  void start_OTA();

  bool begin(String local_name);

  bool connected();

  void send_OTA_DFU(uint8_t value);
  void send_OTA_DFU(uint8_t *value, size_t size);
  void send_OTA_DFU(String value);

  friend void task_install_update(void *parameters);
};

#endif /* SRC_BLE_OTA_DFU_HPP_ */
