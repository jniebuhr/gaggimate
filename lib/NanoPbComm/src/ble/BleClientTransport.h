#ifndef NANOPBCOMM_BLE_CLIENT_TRANSPORT_H
#define NANOPBCOMM_BLE_CLIENT_TRANSPORT_H

#include "../Protocol.h"
#include "../Transport.h"
#include <NimBLEDevice.h>

// BLE central (client) transport for the display: scans, connects, subscribes TX / writes RX (one datagram per op).
// Pairing: bonds to the first controller found, then connects only to it until clearBonds(); links encrypted before GATT use.
class BleClientTransport : public Transport, public NimBLEAdvertisedDeviceCallbacks, public NimBLEClientCallbacks {
  public:
    BleClientTransport() = default;

    void init(const String &deviceName);
    void scan();
    void maintain();        // restart scan if it stalled; call from loop()
    bool connectToServer(); // returns true once connected + subscribed
    bool isReadyForConnection() const { return _readyForConnection; }
    void disconnect();

    // Forget the paired controller so the display can pair to a different one.
    void clearBonds();

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override;

    // Tight ~7.5-10ms conn interval while a shot runs, relaxed ~30-50ms when idle to leave airtime for Wi-Fi.
    void setLowLatency(bool active);

    // Native client handle, needed by ControllerOTA (OTA uses its own service).
    NimBLEClient *getNativeClient() const { return _client; }

    // Fired on old firmware missing the comms chars; link kept for OTA, arg is the legacy INFO characteristic (JSON).
    void onIncompatible(std::function<void(const String &info)> cb) { _onIncompatible = std::move(cb); }

  private:
    NimBLEClient *_client = nullptr;
    NimBLEScan *_scanner = nullptr;
    // Value copy taken in onResult(); with setMaxResults(0) the advertised-device object is freed there (use-after-free trap).
    NimBLEAddress _serverAddress{};
    bool _haveServerAddress = false;
    // Paired controller identity from our own NVS; the scale-shared, evicting NimBLE bond store can't be the source of truth.
    NimBLEAddress _pairedPeer{};
    bool _havePairedPeer = false;
    NimBLERemoteCharacteristic *_writeChar = nullptr;  // to server (RX_CHAR_UUID)
    NimBLERemoteCharacteristic *_notifyChar = nullptr; // from server (TX_CHAR_UUID)
    bool _readyForConnection = false;
    bool _lowLatency = false;
    bool _incompatible = false;
    std::function<void(const String &info)> _onIncompatible = nullptr;

    void applyConnParams();
    // True link-layer encryption state; secureConnection()'s rc lies when it loses an initiation race.
    bool isEncrypted() const;
    void loadPairedPeer();
    void savePairedPeer(const NimBLEAddress &address);
    bool isLockedToOther(NimBLEAdvertisedDevice *advertisedDevice) const;

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
