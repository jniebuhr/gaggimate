#ifndef NANOPBCOMM_BLE_CLIENT_TRANSPORT_H
#define NANOPBCOMM_BLE_CLIENT_TRANSPORT_H

#include "../Protocol.h"
#include "../Transport.h"
#include <NimBLEDevice.h>

/**
 * BLE central (client) transport for the display.
 *
 * Scans for the controller's service, connects, subscribes to its TX
 * characteristic (inbound datagrams) and writes to its RX characteristic
 * (outbound datagrams). Mirrors the connection/scan behaviour of the previous
 * client controller, including the low-duty passive scan tuned for Wi-Fi
 * coexistence.
 */
class BleClientTransport : public Transport, public NimBLEAdvertisedDeviceCallbacks, public NimBLEClientCallbacks {
  public:
    BleClientTransport() = default;

    void init(const String &deviceName);
    void scan();
    void maintain();        // restart scan if it stalled; call from loop()
    bool connectToServer(); // returns true once connected + subscribed
    bool isReadyForConnection() const { return _readyForConnection; }
    void disconnect();

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override;

    // Native client handle, needed by ControllerOTA (OTA uses its own service).
    NimBLEClient *getNativeClient() const { return _client; }

  private:
    NimBLEClient *_client = nullptr;
    NimBLEScan *_scanner = nullptr;
    NimBLEAdvertisedDevice *_serverDevice = nullptr;
    NimBLERemoteCharacteristic *_writeChar = nullptr;  // to server (RX_CHAR_UUID)
    NimBLERemoteCharacteristic *_notifyChar = nullptr; // from server (TX_CHAR_UUID)
    bool _readyForConnection = false;

    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;
    void onDisconnect(NimBLEClient *client) override;
    void notifyCallback(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify);

    static constexpr const char *LOG_TAG = "BleClientTransport";
    static constexpr size_t MAX_CONNECT_RETRIES = 3;
};

#endif // NANOPBCOMM_BLE_CLIENT_TRANSPORT_H
