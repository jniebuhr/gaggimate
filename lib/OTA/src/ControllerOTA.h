#ifndef CONTROLLEROTA_H
#define CONTROLLEROTA_H

#include <Arduino.h>
#include <NimBLEDevice.h>

constexpr char SERVICE_OTA_BLE_UUID[] = "fe590001-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_RX[] = "fe590002-54ae-4a28-9f74-dfccb248601d";
constexpr char CHARACTERISTIC_OTA_BL_UUID_TX[] = "fe590003-54ae-4a28-9f74-dfccb248601d";
constexpr char CONTROLLER_FIRMWARE_PATH[] = "/board-firmware.bin";

constexpr uint16_t DEFAULT_MTU = 120;
constexpr uint16_t PART_SIZE = 19000;
constexpr uint32_t SIGNAL_TIMEOUT_MS = 60000;
constexpr uint32_t SIGNAL_POLL_MS = 5;
constexpr uint16_t WRITE_NR_RETRIES = 400; // x WRITE_NR_BACKOFF_MS = 2 s for the stack to free a TX buffer
constexpr uint32_t WRITE_NR_BACKOFF_MS = 5;
constexpr uint16_t STACK_MTU_OFFSET = 5; // 3 byte ATT header + 2 byte OTA packet header
constexpr uint16_t MAX_MTU = 242;        // BLE_MTU 247 minus STACK_MTU_OFFSET; sizes the packet buffers

using ctr_progress_callback_t = std::function<void(int progress)>;

class ControllerOTA {
  public:
    ControllerOTA() = default;
    ~ControllerOTA() = default;
    void init(const ctr_progress_callback_t &progress_callback);

    bool update(NimBLEClient *client, const String &release_url);

  private:
    bool resolveCharacteristics();
    bool downloadFile(const String &release_url);
    bool runUpdate(Stream &in, uint32_t size);
    bool sendPart(Stream &in, uint32_t totalSize) const;
    bool sendData(uint8_t *data, uint16_t len, bool response = true) const;
    uint8_t waitForSignal();
    bool fillBuffer(Stream &in, uint8_t *buffer, uint16_t len) const;
    void notifyUpdate() const;
    void onReceive(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify);

    NimBLEClient *client = nullptr;
    NimBLERemoteCharacteristic *txChar = nullptr;
    NimBLERemoteCharacteristic *rxChar = nullptr;

    ctr_progress_callback_t progressCallback = nullptr;

    bool interrupted = false;
    volatile uint8_t lastSignal = 0x00; // written from the NimBLE task, polled from the loop task
    volatile bool fastMode = false;     // from the 0xAA reply: controller sends no 0xF1 between parts
    uint32_t currentPart = 0;
    uint32_t fileParts = 0;
    uint16_t _currentMtu = DEFAULT_MTU;
};

#endif // CONTROLLEROTA_H
