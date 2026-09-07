#ifndef NANOPBCOMM_BLE_SERVER_TRANSPORT_H
#define NANOPBCOMM_BLE_SERVER_TRANSPORT_H

#include "../Protocol.h"
#include "../Transport.h"
#include <NimBLEDevice.h>
#include <ble_ota_dfu.hpp>

// BLE peripheral (server) transport for the controller: RX write / TX notify chars (one datagram each) + OTA DFU service.
// Pairing: bonds one display on first boot, then directed-advertises to it only until clearBonds(); comms require encryption.
// A boot-time pairing window (steam switch held at power-on) re-opens advertising so a replacement display can take over.
class BleServerTransport : public Transport, public NimBLEServerCallbacks, public NimBLECharacteristicCallbacks {
  public:
    BleServerTransport() = default;

    // pairingWindow: advertise openly until a display bonds; a new one replaces the paired peer, the old one closes it.
    void init(const String &deviceName, bool pairingWindow = false);
    void startAdvertising();

    // Publish system info on the legacy read-only INFO characteristic for pre-framing external readers.
    void setInfo(const String &info);

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override;
    bool isUpdating() const { return _otaDfu.isUpdating(); };

    // Link-layer disconnect for the ping watchdog: LL_TERMINATE_IND propagates even when GATT writes silently drop.
    void disconnect();

    // Forget the paired display and advertise openly again; escape hatch for replaced hardware.
    void clearBonds();

  private:
    bool _connected = false;
    bool _whitelistOnly = false;
    bool _pairingWindow = false;
    // The single display this PCB is paired to (NVS-persisted); the bond store and whitelist are pruned to match.
    NimBLEAddress _pairedPeer{};
    bool _havePairedPeer = false;
    uint16_t _connHandle = BLE_HS_CONN_HANDLE_NONE;
    NimBLEServer *_server = nullptr;
    NimBLEAdvertising *_advertising = nullptr;
    NimBLECharacteristic *_rxChar = nullptr;   // client -> server (write)
    NimBLECharacteristic *_txChar = nullptr;   // server -> client (notify)
    NimBLECharacteristic *_infoChar = nullptr; // legacy read-only system info
    String _info;
    String _deviceName;
    BLE_OTA_DFU _otaDfu;

    void enableWhitelist();
    void applyAdvertisingData();
    void startAdv(); // directed at the paired display, or open when unpaired
    void adoptPeer(const NimBLEAddress &address);
    void closePairingWindow();
    void pruneForeignBonds(const NimBLEAddress &keep);
    void loadPairedPeer();
    void savePairedPeer(const NimBLEAddress &address);

    void onConnect(NimBLEServer *server) override;
    void onConnect(NimBLEServer *server, ble_gap_conn_desc *desc) override;
    void onAuthenticationComplete(ble_gap_conn_desc *desc) override;
    void onDisconnect(NimBLEServer *server) override;
    void onWrite(NimBLECharacteristic *characteristic) override;
    void onSubscribe(NimBLECharacteristic *pCharacteristic, ble_gap_conn_desc *desc, uint16_t subValue) override;

    static constexpr const char *LOG_TAG = "BleServerTransport";
};

#endif // NANOPBCOMM_BLE_SERVER_TRANSPORT_H
