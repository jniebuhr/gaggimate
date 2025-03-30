#ifndef CONTROLLEROTA_H
#define CONTROLLEROTA_H

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <WiFiClientSecure.h>

constexpr char SERVICE_OTA_BLE_UUID[] = "fe590001-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_RX[] = "fe590002-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_TX[] = "fe590003-54ae-4a28-9f74-dfccb248601d";

constexpr uint16_t MTU = 120;
constexpr uint16_t PART_SIZE = 19000;

using ctr_progress_callback_t = std::function<void(int progress)>;

class ControllerOTA {
  public:
    ControllerOTA() = default;
    ~ControllerOTA() = default;
    void init(NimBLEClient *client, const ctr_progress_callback_t &progress_callback);

    void update(WiFiClientSecure &wifi_client, const String &release_url);

  private:
    bool downloadFile(WiFiClientSecure &wifi_client, const String &release_url);
    void runUpdate(Stream &in, uint32_t size);
    void sendPart(Stream &in, uint32_t totalSize) const;
    void sendData(uint8_t *data, uint16_t len) const;
    void fillBuffer(Stream &in, uint8_t *buffer, uint16_t len) const;
    void notifyUpdate() const;
    void onReceive(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify);

    NimBLEClient *client = nullptr;
    NimBLERemoteCharacteristic *txChar = nullptr;
    NimBLERemoteCharacteristic *rxChar = nullptr;

    ctr_progress_callback_t progressCallback = nullptr;

    bool interrupted = false;
    uint8_t lastSignal = 0x00;
    uint32_t currentPart = 0;
    uint32_t fileParts = 0;
};

#endif // CONTROLLEROTA_H
