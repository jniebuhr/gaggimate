#ifndef NANOPBCOMM_BLE_SERVER_TRANSPORT_H
#define NANOPBCOMM_BLE_SERVER_TRANSPORT_H

#include "../Protocol.h"
#include "../Transport.h"
#include <NimBLEDevice.h>
#include <ble_ota_dfu.hpp>

/**
 * BLE peripheral (server) transport for the controller.
 *
 * Exposes a single RX characteristic (display writes commands) and a single TX
 * characteristic (notifies the display). Each write / notification is one whole
 * datagram. Also hosts the OTA DFU service on the same NimBLE server, exactly
 * as the previous controller transport did.
 */
class BleServerTransport : public Transport, public NimBLEServerCallbacks, public NimBLECharacteristicCallbacks {
  public:
    BleServerTransport() = default;

    void init(const String &deviceName);
    void startAdvertising();

    // Publish system info on the legacy read-only INFO characteristic (kept so
    // external readers that predate the framed protocol still work).
    void setInfo(const String &info);

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override;

    // Tear down the GATT client connection at the link layer. Used by the
    // controller when its ping watchdog fires: an LL_TERMINATE_IND propagates
    // even when GATT writes have been silently dropping, so the display sees
    // the disconnect and rebuilds the link from scratch.
    void disconnect();

  private:
    bool _connected = false;
    uint16_t _connHandle = BLE_HS_CONN_HANDLE_NONE;
    NimBLEServer *_server = nullptr;
    NimBLEAdvertising *_advertising = nullptr;
    NimBLECharacteristic *_rxChar = nullptr;   // client -> server (write)
    NimBLECharacteristic *_txChar = nullptr;   // server -> client (notify)
    NimBLECharacteristic *_infoChar = nullptr; // legacy read-only system info
    String _info;
    BLE_OTA_DFU _otaDfu;

    void onConnect(NimBLEServer *server) override;
    void onConnect(NimBLEServer *server, ble_gap_conn_desc *desc) override;
    void onDisconnect(NimBLEServer *server) override;
    void onWrite(NimBLECharacteristic *characteristic) override;
    void onSubscribe(NimBLECharacteristic *pCharacteristic, ble_gap_conn_desc *desc, uint16_t subValue) override;

    static constexpr const char *LOG_TAG = "BleServerTransport";
};

#endif // NANOPBCOMM_BLE_SERVER_TRANSPORT_H
