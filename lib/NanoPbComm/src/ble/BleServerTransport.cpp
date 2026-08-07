#include "BleServerTransport.h"

void BleServerTransport::init(const String &deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setMTU(256); // headroom for batched frames

    // Just Works bonding with LE Secure Connections: neither board has IO for a
    // passkey (no MITM protection), but the link is encrypted and the keys
    // persist in NVS so the pairing survives reboots.
    NimBLEDevice::setSecurityAuth(true, false, true);
    NimBLEDevice::setSecurityIOCap(BLE_HS_IO_NO_INPUT_OUTPUT);

    _server = NimBLEDevice::createServer();
    _server->setCallbacks(this);

    NimBLEService *service = _server->createService(gm_proto::SERVICE_UUID);
    _rxChar = service->createCharacteristic(gm_proto::RX_CHAR_UUID,
                                            NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR | NIMBLE_PROPERTY::WRITE_ENC);
    _rxChar->setCallbacks(this);
    _txChar = service->createCharacteristic(gm_proto::TX_CHAR_UUID,
                                            NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ_ENC);
    _txChar->setCallbacks(this);
    // INFO stays readable without encryption so legacy/pre-pairing readers work.
    _infoChar = service->createCharacteristic(gm_proto::INFO_CHAR_UUID, NIMBLE_PROPERTY::READ);
    _infoChar->setValue(std::string(_info.c_str()));
    service->start();

    // OTA DFU shares the same server (separate service/UUIDs).
    _otaDfu.configure_OTA(_server);
    _otaDfu.start_OTA();

    _advertising = NimBLEDevice::getAdvertising();
    _advertising->addServiceUUID(gm_proto::SERVICE_UUID);
    _advertising->setScanResponse(true);
    // First boot pairs openly; once a display has bonded, only it may connect.
    for (int i = 0; i < NimBLEDevice::getNumBonds(); i++)
        NimBLEDevice::whiteListAdd(NimBLEDevice::getBondedAddress(i));
    if (NimBLEDevice::getWhiteListCount() > 0)
        enableWhitelist();
    _advertising->start();
    ESP_LOGI(LOG_TAG, "BLE server started, advertising %s", _whitelistOnly ? "(whitelist only)" : "(open, pairing mode)");
}

void BleServerTransport::enableWhitelist() {
    _whitelistOnly = true;
    _advertising->setScanFilter(true, true);
}

void BleServerTransport::whitelistPeer(const NimBLEAddress &address) {
    for (size_t i = 0; i < NimBLEDevice::getWhiteListCount(); i++) {
        if (NimBLEDevice::getWhiteListAddress(i) == address)
            return; // already paired to this display
    }
    if (NimBLEDevice::whiteListAdd(address)) {
        enableWhitelist();
        ESP_LOGI(LOG_TAG, "Bonded to %s, advertising is now whitelist-only", address.toString().c_str());
    }
}

void BleServerTransport::clearBonds() {
    bool wasAdvertising = _advertising && _advertising->isAdvertising();
    if (wasAdvertising)
        _advertising->stop();
    while (NimBLEDevice::getWhiteListCount() > 0)
        NimBLEDevice::whiteListRemove(NimBLEDevice::getWhiteListAddress(0));
    NimBLEDevice::deleteAllBonds();
    _whitelistOnly = false;
    if (_advertising)
        _advertising->setScanFilter(false, false);
    ESP_LOGW(LOG_TAG, "Bonds cleared, open for pairing");
    disconnect(); // drop the current peer (if any) so the next link re-pairs
    if (wasAdvertising)
        _advertising->start();
}

void BleServerTransport::startAdvertising() {
    if (_advertising && !_advertising->isAdvertising())
        _advertising->start();
}

void BleServerTransport::setInfo(const String &info) {
    _info = info;
    if (_infoChar)
        _infoChar->setValue(std::string(info.c_str()));
}

bool BleServerTransport::send(const uint8_t *data, size_t length) {
    if (!_connected || _txChar == nullptr)
        return false;
    _txChar->setValue(data, length);
    _txChar->notify(); // NimBLE-Arduino 1.4.0: notify() returns void
    return true;
}

bool BleServerTransport::isConnected() const { return _connected; }

void BleServerTransport::onConnect(NimBLEServer *server) {
    _connected = true;
    server->stopAdvertising();
    ESP_LOGI(LOG_TAG, "Client connected");
    emitConnection(true);
}

void BleServerTransport::onConnect(NimBLEServer *server, ble_gap_conn_desc *desc) {
    // NimBLE 1.x dispatches both onConnect overloads; this one carries the conn
    // handle we need for an explicit disconnect() when the ping watchdog fires.
    if (desc) {
        _connHandle = desc->conn_handle;
        // Deliberately no startSecurity() here: the display is the sole security
        // initiator. Dual initiation raced (EALREADY) and could stall pairing
        // until the SMP timeout. Old displays without an initiator still elevate
        // via NimBLE's insufficient-auth retry on the encrypted RX writes.
    }
}

void BleServerTransport::onAuthenticationComplete(ble_gap_conn_desc *desc) {
    if (desc == nullptr)
        return;
    if (!desc->sec_state.encrypted) {
        // Comms characteristics require encryption anyway; drop peers that
        // cannot pair instead of leaving a half-usable link up.
        ESP_LOGW(LOG_TAG, "Pairing/encryption failed, dropping connection");
        _server->disconnect(desc->conn_handle);
        return;
    }
    if (desc->sec_state.bonded)
        whitelistPeer(NimBLEAddress(desc->peer_id_addr));
}

void BleServerTransport::onDisconnect(NimBLEServer *server) {
    _connected = false;
    _connHandle = BLE_HS_CONN_HANDLE_NONE;
    ESP_LOGI(LOG_TAG, "Client disconnected");
    emitConnection(false);
    server->startAdvertising();
}

void BleServerTransport::disconnect() {
    if (_connected && _server && _connHandle != BLE_HS_CONN_HANDLE_NONE) {
        ESP_LOGW(LOG_TAG, "Forcing client disconnect (conn=%u)", _connHandle);
        _server->disconnect(_connHandle);
    }
}

void BleServerTransport::onWrite(NimBLECharacteristic *characteristic) {
    if (characteristic != _rxChar)
        return;
    NimBLEAttValue value = characteristic->getValue();
    if (value.length() > 0)
        emitData(value.data(), value.length());
}

void BleServerTransport::onSubscribe(NimBLECharacteristic *pCharacteristic, ble_gap_conn_desc *desc, uint16_t subValue) {
    emitConnection(true);
}
