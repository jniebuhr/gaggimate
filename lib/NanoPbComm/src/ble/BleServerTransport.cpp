#include "BleServerTransport.h"
#include <Preferences.h>

// Paired display address in our own NVS; the pairing is strictly one PCB <-> one screen, unlike the bond store.
static constexpr const char *NVS_NAMESPACE = "gmble";
static constexpr const char *NVS_PEER_KEY = "peer";

void BleServerTransport::init(const String &deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setMTU(256); // headroom for batched frames

    // Just Works bonding + LE Secure Connections (no IO -> no MITM); keys persist in NVS across reboots.
    NimBLEDevice::setSecurityAuth(true, false, true);
    NimBLEDevice::setSecurityIOCap(BLE_HS_IO_NO_INPUT_OUTPUT);

    _server = NimBLEDevice::createServer();
    _server->setCallbacks(this);
    // Restart advertising ourselves in onDisconnect; the automatic restart would bypass the directed/paired mode.
    _server->advertiseOnDisconnect(false);

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

    _deviceName = deviceName;
    _advertising = NimBLEDevice::getAdvertising();
    _advertising->setScanResponse(true);
    // First boot pairs openly; once a display has bonded, only it may connect.
    loadPairedPeer();
    if (_havePairedPeer) {
        NimBLEDevice::whiteListAdd(_pairedPeer);
        enableWhitelist();
        pruneForeignBonds(_pairedPeer);
        ESP_LOGI(LOG_TAG, "Paired to display %s", _pairedPeer.toString().c_str());
    } else if (NimBLEDevice::getNumBonds() > 0) {
        // Migration from multi-bond builds: allow all bonded displays and adopt the first one that encrypts.
        for (int i = 0; i < NimBLEDevice::getNumBonds(); i++) {
            NimBLEAddress addr = NimBLEDevice::getBondedAddress(i);
            NimBLEDevice::whiteListAdd(addr);
            ESP_LOGW(LOG_TAG, "Legacy bond %s allowed until one display is adopted", addr.toString().c_str());
        }
        enableWhitelist();
    }
    applyAdvertisingData();
    startAdv();
    ESP_LOGI(LOG_TAG, "BLE server started, advertising %s",
             _havePairedPeer ? "(directed to paired display)" : (_whitelistOnly ? "(whitelist only)" : "(open, pairing mode)"));
}

void BleServerTransport::startAdv() {
    if (_advertising == nullptr || _advertising->isAdvertising())
        return;
    if (_havePairedPeer) {
        // Low-duty directed adverts are LL-dropped by every radio except the paired display's -- invisible to other scanners.
        _advertising->setAdvertisementType(BLE_GAP_CONN_MODE_DIR);
        _advertising->start(0, nullptr, &_pairedPeer);
    } else {
        _advertising->setAdvertisementType(BLE_GAP_CONN_MODE_UND);
        _advertising->start();
    }
}

void BleServerTransport::applyAdvertisingData() {
    // Primary adv packet (31B): flags + service UUID + lock-owner mfg data; owner must be primary, displays scan passively.
    std::vector<uint8_t> mfg = {0xFF, 0xFF, 0, 0, 0, 0, 0, 0};
    if (_havePairedPeer)
        memcpy(&mfg[2], _pairedPeer.getNative(), 6);
    NimBLEAdvertisementData advData;
    advData.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
    advData.setCompleteServices(NimBLEUUID(gm_proto::SERVICE_UUID));
    advData.setManufacturerData(mfg);
    _advertising->setAdvertisementData(advData);
    NimBLEAdvertisementData scanResp;
    scanResp.setName(std::string(_deviceName.c_str()));
    _advertising->setScanResponseData(scanResp);
}

void BleServerTransport::enableWhitelist() {
    _whitelistOnly = true;
    _advertising->setScanFilter(true, true);
}

void BleServerTransport::adoptPeer(const NimBLEAddress &address) {
    if (_havePairedPeer) {
        if (_pairedPeer == address)
            return; // our display, nothing to do
        // Whitelisting should make this impossible; refuse the interloper.
        ESP_LOGW(LOG_TAG, "Rejecting bond from foreign display %s", address.toString().c_str());
        NimBLEDevice::deleteBond(address);
        disconnect();
        return;
    }
    savePairedPeer(address);
    pruneForeignBonds(address);
    // Reduce the (possibly legacy multi-bond) whitelist to this display; safe while connected, advertising is stopped.
    while (NimBLEDevice::getWhiteListCount() > 0)
        NimBLEDevice::whiteListRemove(NimBLEDevice::getWhiteListAddress(0));
    NimBLEDevice::whiteListAdd(address);
    enableWhitelist();
    applyAdvertisingData(); // broadcast the new lock owner from the next adv start
    ESP_LOGI(LOG_TAG, "Bonded to display %s, advertising is now whitelist-only", address.toString().c_str());
}

void BleServerTransport::pruneForeignBonds(const NimBLEAddress &keep) {
    std::vector<NimBLEAddress> foreign;
    for (int i = 0; i < NimBLEDevice::getNumBonds(); i++) {
        NimBLEAddress addr = NimBLEDevice::getBondedAddress(i);
        if (addr != keep)
            foreign.push_back(addr);
    }
    for (auto &addr : foreign) {
        ESP_LOGW(LOG_TAG, "Removing stale bond %s", addr.toString().c_str());
        NimBLEDevice::deleteBond(addr);
    }
}

void BleServerTransport::loadPairedPeer() {
    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, true))
        return;
    uint8_t buf[7];
    if (prefs.getBytes(NVS_PEER_KEY, buf, sizeof(buf)) == sizeof(buf)) {
        // Bytes are native order from getNative(); the uint8_t[6] ctor would reverse them, so restore via ble_addr_t.
        ble_addr_t addr;
        memcpy(addr.val, buf, 6);
        addr.type = buf[6];
        _pairedPeer = NimBLEAddress(addr);
        _havePairedPeer = true;
    }
    prefs.end();
}

void BleServerTransport::savePairedPeer(const NimBLEAddress &address) {
    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, false))
        return;
    uint8_t buf[7];
    memcpy(buf, address.getNative(), 6);
    buf[6] = address.getType();
    prefs.putBytes(NVS_PEER_KEY, buf, sizeof(buf));
    prefs.end();
    _pairedPeer = address;
    _havePairedPeer = true;
}

void BleServerTransport::clearBonds() {
    bool wasAdvertising = _advertising && _advertising->isAdvertising();
    if (wasAdvertising)
        _advertising->stop();
    while (NimBLEDevice::getWhiteListCount() > 0)
        NimBLEDevice::whiteListRemove(NimBLEDevice::getWhiteListAddress(0));
    NimBLEDevice::deleteAllBonds();
    Preferences prefs;
    if (prefs.begin(NVS_NAMESPACE, false)) {
        prefs.remove(NVS_PEER_KEY);
        prefs.end();
    }
    _havePairedPeer = false;
    _whitelistOnly = false;
    if (_advertising) {
        _advertising->setScanFilter(false, false);
        applyAdvertisingData(); // owner field back to zeros (open for pairing)
    }
    ESP_LOGW(LOG_TAG, "Bonds cleared, open for pairing");
    disconnect(); // drop the current peer (if any) so the next link re-pairs
    if (wasAdvertising)
        startAdv();
}

void BleServerTransport::startAdvertising() { startAdv(); }

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
    // Deliberately no startSecurity() here: the display is the sole initiator (dual initiation raced via EALREADY).
    if (desc)
        _connHandle = desc->conn_handle;
}

void BleServerTransport::onAuthenticationComplete(ble_gap_conn_desc *desc) {
    if (desc == nullptr)
        return;
    if (!desc->sec_state.encrypted) {
        // Comms characteristics require encryption anyway; drop peers that cannot pair rather than keep a half-usable link.
        ESP_LOGW(LOG_TAG, "Pairing/encryption failed, dropping connection");
        _server->disconnect(desc->conn_handle);
        return;
    }
    if (desc->sec_state.bonded)
        adoptPeer(NimBLEAddress(desc->peer_id_addr));
}

void BleServerTransport::onDisconnect(NimBLEServer *server) {
    _connected = false;
    _connHandle = BLE_HS_CONN_HANDLE_NONE;
    ESP_LOGI(LOG_TAG, "Client disconnected");
    emitConnection(false);
    startAdv();
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
