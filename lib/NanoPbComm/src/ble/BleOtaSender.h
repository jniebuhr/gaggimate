#ifndef NANOPBCOMM_BLE_OTA_SENDER_H
#define NANOPBCOMM_BLE_OTA_SENDER_H

#include "../OtaSender.h"
#include "BleClientTransport.h"
#include "BleOta.h"
#include <NimBLEDevice.h>

// Display side of the BLE firmware update (protocol in BleOta.h); streams the image to the controller's BleOtaReceiver.
class BleOtaSender : public OtaSender {
  public:
    explicit BleOtaSender(BleClientTransport &transport) : _transport(transport) {}

    bool isLinkUp() const override;
    bool run(uint32_t size, const uint8_t md5[MD5_LEN], const ReadFn &read, const ProgressFn &progress) override;

  private:
    static constexpr uint16_t DEFAULT_MTU = 120;
    static constexpr uint16_t PART_SIZE = 19000;
    static constexpr uint32_t SIGNAL_TIMEOUT_MS = 60000;
    static constexpr uint32_t SIGNAL_POLL_MS = 5;
    static constexpr uint16_t WRITE_RETRIES = 400; // x WRITE_RETRY_BACKOFF_MS = 2 s for the stack to free a TX buffer
    static constexpr uint32_t WRITE_RETRY_BACKOFF_MS = 5;
    static constexpr int MIN_FREE_TX_BUFFERS = 4; // NimBLE msys blocks kept free during the packet burst
    static constexpr uint32_t TX_BUFFER_POLL_MS = 2;
    static constexpr uint16_t STACK_MTU_OFFSET = 5; // 3 byte ATT header + 2 byte OTA packet header
    static constexpr uint16_t MAX_MTU = 242;        // BLE_MTU 247 minus STACK_MTU_OFFSET; sizes the packet buffers

    BleClientTransport &_transport;
    NimBLEClient *_client = nullptr;
    NimBLERemoteCharacteristic *_txChar = nullptr;
    NimBLERemoteCharacteristic *_rxChar = nullptr;

    volatile uint8_t _lastSignal = 0x00; // written from the NimBLE task, polled from the calling task
    volatile bool _fastMode = false;     // from the 0xAA reply: controller sends no 0xF1 between parts
    uint32_t _currentPart = 0;
    uint32_t _fileParts = 0;
    uint32_t _offset = 0;
    uint16_t _currentMtu = DEFAULT_MTU;

    bool resolveCharacteristics();
    bool transfer(uint32_t size, const ReadFn &read, const ProgressFn &progress);
    bool sendPart(uint32_t totalSize, const ReadFn &read);
    bool sendPacket(uint8_t index, uint16_t len, const ReadFn &read);
    bool sendData(uint8_t *data, uint16_t len, bool response = true) const;
    uint8_t waitForSignal();
    void onReceive(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify);

    static constexpr const char *LOG_TAG = "BleOtaSender";
};

#endif // NANOPBCOMM_BLE_OTA_SENDER_H
