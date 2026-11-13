/* Copyright 2022 Vincent Stragier */
// Highly inspired by https://github.com/fbiego/ESP32_BLE_OTA_Arduino
#ifndef NANOPBCOMM_BLE_OTA_RECEIVER_H
#define NANOPBCOMM_BLE_OTA_RECEIVER_H

#include "BleOta.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_ota_ops.h>

// Controller side of the BLE firmware update (protocol in BleOta.h); streams each part straight into the inactive app partition.
class BleOtaReceiver final : public NimBLECharacteristicCallbacks {
  public:
    BleOtaReceiver() = default;

    // Add the OTA service to the comms server; call before advertising starts.
    bool begin(NimBLEServer *server);

    bool isUpdating() const { return _updating; }
    // Drop a half-received update when the link goes away.
    void onDisconnect();

  private:
    static constexpr uint32_t PART_BUFFER_SIZE = 20000;
    static constexpr uint32_t FINISH_TASK_STACK = 6144;
    static constexpr uint32_t RESTART_DELAY_MS = 3000;

    NimBLEServer *_server = nullptr;
    NimBLECharacteristic *_txChar = nullptr;
    volatile bool _updating = false; // written from the NimBLE task, read from the controller loop

    uint8_t _partBuffer[PART_BUFFER_SIZE]{};
    uint16_t _parts = 0;
    uint16_t _packetSize = 0;
    uint16_t _nextPart = 0;
    uint32_t _receivedSize = 0;
    uint32_t _expectedSize = 0;
    esp_ota_handle_t _otaHandle = 0;
    const esp_partition_t *_otaPartition = nullptr;
    volatile bool _finishing = false;

    void onWrite(NimBLECharacteristic *characteristic) override;
    bool beginUpdate();
    bool writePart(uint16_t length, uint16_t part);
    void abortUpdate(const char *reason);
    void notifyProgress(uint8_t signal, uint16_t part);
    void notify(const uint8_t *value, size_t size);
    bool connected() const;
    static void finishTask(void *arg);

    static constexpr const char *LOG_TAG = "BleOtaReceiver";
};

#endif // NANOPBCOMM_BLE_OTA_RECEIVER_H
