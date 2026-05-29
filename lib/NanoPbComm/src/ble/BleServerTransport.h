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

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override;

  private:
    bool _connected = false;
    NimBLEServer *_server = nullptr;
    NimBLEAdvertising *_advertising = nullptr;
    NimBLECharacteristic *_rxChar = nullptr; // client -> server (write)
    NimBLECharacteristic *_txChar = nullptr; // server -> client (notify)
    BLE_OTA_DFU _otaDfu;

    void onConnect(NimBLEServer *server) override;
    void onDisconnect(NimBLEServer *server) override;
    void onWrite(NimBLECharacteristic *characteristic) override;

    static constexpr const char *LOG_TAG = "BleServerTransport";
};

#endif // NANOPBCOMM_BLE_SERVER_TRANSPORT_H
