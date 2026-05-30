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

    // Choose the connection interval: low-latency (tight, ~7.5-10ms) while a
    // shot is running for responsive control, relaxed (~30-50ms) when idle so
    // the shared 2.4GHz radio leaves more contiguous airtime for Wi-Fi.
    void setLowLatency(bool active);

    // Native client handle, needed by ControllerOTA (OTA uses its own service).
    NimBLEClient *getNativeClient() const { return _client; }

    // Fired when we connect to a GaggiMate controller that advertises the
    // service but is missing the framed-comms characteristics (an old /
    // incompatible firmware). The BLE link is intentionally kept up so the
    // separate OTA service stays reachable.
    void onIncompatible(std::function<void()> cb) { _onIncompatible = std::move(cb); }

  private:
    NimBLEClient *_client = nullptr;
    NimBLEScan *_scanner = nullptr;
    NimBLEAdvertisedDevice *_serverDevice = nullptr;
    NimBLERemoteCharacteristic *_writeChar = nullptr;  // to server (RX_CHAR_UUID)
    NimBLERemoteCharacteristic *_notifyChar = nullptr; // from server (TX_CHAR_UUID)
    bool _readyForConnection = false;
    bool _lowLatency = false;
    bool _incompatible = false;
    std::function<void()> _onIncompatible = nullptr;

    void applyConnParams();

    // Connection-interval units are 1.25ms; supervision timeout units are 10ms.
    static constexpr uint16_t ACTIVE_MIN_INTERVAL = 6; // 7.5 ms
    static constexpr uint16_t ACTIVE_MAX_INTERVAL = 8; // 10 ms
    static constexpr uint16_t IDLE_MIN_INTERVAL = 24;  // 30 ms
    static constexpr uint16_t IDLE_MAX_INTERVAL = 40;  // 50 ms
    static constexpr uint16_t CONN_LATENCY = 0;
    static constexpr uint16_t CONN_TIMEOUT = 400; // 4 s

    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;
    void onDisconnect(NimBLEClient *client) override;
    void notifyCallback(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify);

    static constexpr const char *LOG_TAG = "BleClientTransport";
    static constexpr size_t MAX_CONNECT_RETRIES = 3;
};

#endif // NANOPBCOMM_BLE_CLIENT_TRANSPORT_H
