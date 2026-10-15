#include "BleServerTransport.h"
#include <Preferences.h>

// Paired display address in our own NVS; the pairing is strictly one PCB <-> one screen, unlike the bond store.
static constexpr const char *NVS_NAMESPACE = "gmble";
static constexpr const char *NVS_PEER_KEY = "peer";

void BleServerTransport::init(const String &deviceName, bool pairingWindow) {
    _pairingWindow = pairingWindow;
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setMTU(BLE_MTU); // headroom for batched frames
    if (int rc = ble_gap_write_sugg_def_data_len(BLE_DLE_OCTETS, BLE_DLE_TIME_US); rc != 0)
        ESP_LOGW(LOG_TAG, "Setting suggested data length failed: %d", rc);

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
    // Inert stub: displays <= v1.8.1 null-deref a missing error characteristic and crash-loop (GM-221).
    service->createCharacteristic(gm_proto::LEGACY_ERROR_CHAR_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY)
        ->setValue(std::string("0"));
    service->start();

    // OTA DFU shares the same server (separate service/UUIDs).
    _otaDfu.configure_OTA(_server);

    _deviceName = deviceName;
    _advertising = NimBLEDevice::getAdvertising();
    _advertising->setScanResponse(true);
    // First boot pairs openly; once a display has bonded, only it may connect (unless the pairing window is open).
    loadPairedPeer();
    if (_havePairedPeer) {
        _peerUsesPrivacy = bondHasIrk(_pairedPeer);
        NimBLEDevice::whiteListAdd(_pairedPeer);
        pruneForeignBonds(_pairedPeer);
        ESP_LOGI(LOG_TAG, "Paired to display %s", _pairedPeer.toString().c_str());
    } else if (NimBLEDevice::getNumBonds() > 0) {
        // Migration from multi-bond builds: allow all bonded displays and adopt the first one that encrypts.
        for (int i = 0; i < NimBLEDevice::getNumBonds(); i++) {
            NimBLEAddress addr = NimBLEDevice::getBondedAddress(i);
            NimBLEDevice::whiteListAdd(addr);
            ESP_LOGW(LOG_TAG, "Legacy bond %s allowed until one display is adopted", addr.toString().c_str());
        }
    }
    // The whitelist stays populated but unenforced while the window is open; closePairingWindow() re-arms it.
    if (NimBLEDevice::getWhiteListCount() > 0 && !_pairingWindow)
        enableWhitelist();
    if (_pairingWindow)
        ESP_LOGW(LOG_TAG, "Pairing window open, a new display may replace the paired one");
    applyAdvertisingData();
    startAdv();
    ESP_LOGI(LOG_TAG, "BLE server started, advertising %s",
             _pairingWindow ? "(open, pairing window)"
             : _havePairedPeer
                 ? (_peerUsesPrivacy ? "(whitelist, paired display uses private addresses)" : "(directed to paired display)")
                 : (_whitelistOnly ? "(whitelist only)" : "(open, pairing mode)"));
}

void BleServerTransport::startAdv() {
    if (_advertising == nullptr || _advertising->isAdvertising())
        return;
    if (_havePairedPeer && !_pairingWindow && !_peerUsesPrivacy) {
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
    // Owner stays zeroed while the pairing window is open so unpaired displays see us as available.
    if (_havePairedPeer && !_pairingWindow)
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
    if (_havePairedPeer && _pairedPeer == address) {
        closePairingWindow(); // our display; an accidental steam-switch boot ends here
        return;
    }
    if (_havePairedPeer && !_pairingWindow) {
        // Whitelisting should make this impossible; refuse the interloper.
        ESP_LOGW(LOG_TAG, "Rejecting bond from foreign display %s", address.toString().c_str());
        NimBLEDevice::deleteBond(address);
        disconnect();
        return;
    }
    if (_havePairedPeer)
        ESP_LOGW(LOG_TAG, "Replacing paired display %s with %s", _pairedPeer.toString().c_str(), address.toString().c_str());
    _pairingWindow = false;
    savePairedPeer(address);
    _peerUsesPrivacy = bondHasIrk(address);
    pruneForeignBonds(address);
    // Reduce the (possibly legacy multi-bond) whitelist to this display; safe while connected, advertising is stopped.
    while (NimBLEDevice::getWhiteListCount() > 0)
        NimBLEDevice::whiteListRemove(NimBLEDevice::getWhiteListAddress(0));
    NimBLEDevice::whiteListAdd(address);
    enableWhitelist();
    applyAdvertisingData(); // broadcast the new lock owner from the next adv start
    ESP_LOGI(LOG_TAG, "Bonded to display %s, advertising is now whitelist-only", address.toString().c_str());
}

void BleServerTransport::closePairingWindow() {
    if (!_pairingWindow)
        return;
    _pairingWindow = false;
    if (NimBLEDevice::getWhiteListCount() > 0)
        enableWhitelist();
    applyAdvertisingData(); // owner field back on; the next adv start is directed again
    ESP_LOGI(LOG_TAG, "Pairing window closed, back to the paired display only");
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

bool BleServerTransport::bondHasIrk(const NimBLEAddress &address) {
    // A privacy-enabled display connects from rotating private addresses that a directed advert to its identity
    // never reaches; such peers get undirected adverts and are matched by the whitelist through the resolving list.
    struct ble_store_key_sec key = {};
    memcpy(key.peer_addr.val, address.getNative(), 6);
    key.peer_addr.type = address.getType();
    struct ble_store_value_sec value;
    return ble_store_read_peer_sec(&key, &value) == 0 && value.irk_present;
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
        // Earlier builds adopted the peer before its identity arrived and stored a resolvable private address for
        // privacy-enabled displays. It goes stale when the display rotates it, and pruning against it deleted the
        // display's real bond. Forget it; the legacy-bond path re-adopts the display by its identity on its next
        // encrypted link.
        if (addr.type == BLE_ADDR_RANDOM && (addr.val[5] & 0xC0) == 0x40) {
            ESP_LOGW(LOG_TAG, "Dropping stored private address %s; the paired display re-adopts by identity",
                     NimBLEAddress(addr).toString().c_str());
            prefs.end();
            if (prefs.begin(NVS_NAMESPACE, false)) {
                prefs.remove(NVS_PEER_KEY);
                prefs.end();
            }
            return;
        }
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
    _pairingWindow = false;
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
    // Negotiate the controller's transmit length too; ATT MTU alone leaves
    // telemetry fragmented into small packets and can exhaust the BLE packet pool.
    _server->setDataLen(desc->conn_handle, BLE_DLE_OCTETS);
    if (desc->sec_state.bonded) {
        _adoptPending = true;
        tryAdoptPeer(desc->conn_handle);
    }
}

void BleServerTransport::tryAdoptPeer(uint16_t connHandle) {
    // On a first pairing this runs at encryption, before key distribution: a privacy-enabled display's identity address (and IRK)
    // is not known yet and peer_id_addr is still its private address. Wait until the bond is stored under the identity address,
    // whose IRK then sits in the controller's resolving list for the whitelist.
    ble_gap_conn_desc desc;
    if (ble_gap_conn_find(connHandle, &desc) != 0)
        return;
    struct ble_store_key_sec key = {};
    key.peer_addr = desc.peer_id_addr;
    struct ble_store_value_sec value;
    if (ble_store_read_peer_sec(&key, &value) != 0)
        return;
    _adoptPending = false;
    adoptPeer(NimBLEAddress(desc.peer_id_addr));
}

void BleServerTransport::onDisconnect(NimBLEServer *server) {
    _connected = false;
    _connHandle = BLE_HS_CONN_HANDLE_NONE;
    _adoptPending = false;
    ESP_LOGI(LOG_TAG, "Client disconnected");
    _otaDfu.onDisconnect();
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
    if (_adoptPending)
        tryAdoptPeer(_connHandle);
    NimBLEAttValue value = characteristic->getValue();
    if (value.length() > 0)
        emitData(value.data(), value.length());
}

void BleServerTransport::onSubscribe(NimBLECharacteristic *pCharacteristic, ble_gap_conn_desc *desc, uint16_t subValue) {
    emitConnection(true);
}
