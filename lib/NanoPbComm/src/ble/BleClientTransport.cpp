#include "BleClientTransport.h"
#include <Preferences.h>

// Paired controller address in our own NVS; NimBLE's bond store is shared with scales (3 slots, evicting) and can't gate this.
static constexpr const char *NVS_NAMESPACE = "gmble";
static constexpr const char *NVS_PEER_KEY = "peer";

void BleClientTransport::init(const String &deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setMTU(256);
    // Just Works bonding with LE Secure Connections, mirroring the controller.
    NimBLEDevice::setSecurityAuth(true, false, true);
    NimBLEDevice::setSecurityIOCap(BLE_HS_IO_NO_INPUT_OUTPUT);
    loadPairedPeer();
    _client = NimBLEDevice::createClient();
    _scanner = NimBLEDevice::getScan();
    if (_client == nullptr) {
        ESP_LOGE(LOG_TAG, "Failed to create BLE client");
        return;
    }
    _client->setClientCallbacks(this);
    scan();
}

void BleClientTransport::scan() {
    _readyForConnection = false;
    _scanner->clearDuplicateCache();
    _scanner->setAdvertisedDeviceCallbacks(this, true);
    _scanner->setInterval(1000);
    _scanner->setWindow(50);
    _scanner->setMaxResults(0);
    _scanner->setDuplicateFilter(false);
    _scanner->setActiveScan(false);
    _scanner->start(0, nullptr, false); // 0 = continuous
}

void BleClientTransport::maintain() {
    if (_client == nullptr || _scanner == nullptr)
        return; // init() failed to create the client/scanner
    if (!_readyForConnection && !_client->isConnected() && !_scanner->isScanning()) {
        ESP_LOGI(LOG_TAG, "Scan stalled, restarting");
        scan();
    }
}

bool BleClientTransport::connectToServer() {
    if (!_haveServerAddress)
        return false;

    ESP_LOGI(LOG_TAG, "Connecting to advertised device");
    unsigned int tries = 0;
    do {
        if (tries >= MAX_CONNECT_RETRIES) {
            ESP_LOGE(LOG_TAG, "Connection timeout, rescanning");
            scan();
            return false;
        }
        if (!_client->connect(_serverAddress)) {
            ESP_LOGW(LOG_TAG, "Connect failed, retrying");
            delay(500);
        }
        tries++;
    } while (!_client->isConnected());
    applyConnParams(); // baseline for the new connection (idle unless set active)

    // Secure before GATT use; trust the link state over the rc (losing the initiation race reports EALREADY as failure).
    if (!isEncrypted() && !_client->secureConnection() && !isEncrypted()) {
        if (NimBLEDevice::isBonded(_serverAddress)) {
            // Stale bond (controller re-flashed): drop our key and pair freshly.
            ESP_LOGW(LOG_TAG, "Encryption with stored key failed, re-pairing");
            NimBLEDevice::deleteBond(_serverAddress);
            if (!_client->secureConnection() && !isEncrypted()) {
                ESP_LOGE(LOG_TAG, "Pairing failed, rescanning");
                _client->disconnect();
                scan();
                return false;
            }
        } else {
            // Old controller firmware may not pair; keep the link so the OTA-recovery path below still works.
            ESP_LOGW(LOG_TAG, "Securing link failed, continuing unencrypted");
        }
    }

    NimBLERemoteService *service = _client->getService(NimBLEUUID(gm_proto::SERVICE_UUID));
    if (service == nullptr) {
        ESP_LOGE(LOG_TAG, "Service not found");
        _client->disconnect();
        scan();
        return false;
    }

    _writeChar = service->getCharacteristic(NimBLEUUID(gm_proto::RX_CHAR_UUID));
    _notifyChar = service->getCharacteristic(NimBLEUUID(gm_proto::TX_CHAR_UUID));
    if (_writeChar == nullptr || _notifyChar == nullptr) {
        // Missing comms chars -> old/incompatible firmware; keep the link up so the separate OTA service stays reachable.
        ESP_LOGW(LOG_TAG, "Comms characteristics missing -- incompatible controller firmware (OTA only)");
        _writeChar = nullptr;
        _notifyChar = nullptr;
        _readyForConnection = false;
        _incompatible = true;
        // Read the legacy INFO characteristic so the display can show the real hardware/version.
        String info;
        NimBLERemoteCharacteristic *infoChar = service->getCharacteristic(NimBLEUUID(gm_proto::INFO_CHAR_UUID));
        if (infoChar != nullptr && infoChar->canRead())
            info = String(infoChar->readValue().c_str());
        if (_onIncompatible)
            _onIncompatible(info);
        return true; // link intentionally kept; do not disconnect/rescan
    }

    // Without the notify subscription we would never receive data; treat a failed subscribe as a failed connection.
    if (!_notifyChar->canNotify() ||
        !_notifyChar->subscribe(true, std::bind(&BleClientTransport::notifyCallback, this, std::placeholders::_1,
                                                std::placeholders::_2, std::placeholders::_3, std::placeholders::_4))) {
        ESP_LOGE(LOG_TAG, "Failed to subscribe to TX characteristic");
        _client->disconnect();
        scan();
        return false;
    }

    _readyForConnection = false;
    _incompatible = false;
    // Persist the pairing only once a bond exists; until then the display keeps connecting openly.
    if (NimBLEDevice::isBonded(_serverAddress))
        savePairedPeer(_serverAddress);
    ESP_LOGI(LOG_TAG, "Connected, MTU: %d", _client->getMTU());
    emitConnection(true);
    return true;
}

void BleClientTransport::loadPairedPeer() {
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
        ESP_LOGI(LOG_TAG, "Paired to controller %s", _pairedPeer.toString().c_str());
    }
    prefs.end();
}

void BleClientTransport::savePairedPeer(const NimBLEAddress &address) {
    if (_havePairedPeer && _pairedPeer == address)
        return;
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
    ESP_LOGI(LOG_TAG, "Locked to controller %s", address.toString().c_str());
}

void BleClientTransport::clearBonds() {
    // Only forget the controller; bonds a BLE scale may hold stay intact.
    if (_havePairedPeer)
        NimBLEDevice::deleteBond(_pairedPeer);
    Preferences prefs;
    if (prefs.begin(NVS_NAMESPACE, false)) {
        prefs.remove(NVS_PEER_KEY);
        prefs.end();
    }
    _havePairedPeer = false;
    ESP_LOGW(LOG_TAG, "Pairing cleared, will pair with the next controller found");
    if (_client && _client->isConnected())
        disconnect(); // onDisconnect restarts the (now unfiltered) scan
}

void BleClientTransport::disconnect() {
    _readyForConnection = false;
    _haveServerAddress = false;
    if (_client && _client->isConnected())
        _client->disconnect();
}

void BleClientTransport::setLowLatency(bool active) {
    _lowLatency = active;
    applyConnParams();
}

void BleClientTransport::applyConnParams() {
    if (_client == nullptr || !_client->isConnected())
        return;
    if (_lowLatency)
        _client->updateConnParams(ACTIVE_MIN_INTERVAL, ACTIVE_MAX_INTERVAL, CONN_LATENCY, CONN_TIMEOUT);
    else
        _client->updateConnParams(IDLE_MIN_INTERVAL, IDLE_MAX_INTERVAL, CONN_LATENCY, CONN_TIMEOUT);
}

bool BleClientTransport::send(const uint8_t *data, size_t length) {
    if (!isConnected() || _writeChar == nullptr || data == nullptr || length == 0)
        return false;
    return _writeChar->writeValue(data, length, false); // write without response
}

bool BleClientTransport::isConnected() const { return _client != nullptr && _client->isConnected(); }

bool BleClientTransport::isEncrypted() const {
    if (_client == nullptr || !_client->isConnected())
        return false;
    ble_gap_conn_desc desc;
    if (ble_gap_conn_find(_client->getConnId(), &desc) != 0)
        return false;
    return desc.sec_state.encrypted;
}

void BleClientTransport::onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    if (_havePairedPeer) {
        // Our controller advertises directed PDUs, which carry no payload -- match on address alone.
        if (advertisedDevice->getAddress() != _pairedPeer)
            return;
    } else {
        const bool gmService =
            advertisedDevice->haveServiceUUID() && advertisedDevice->isAdvertisingService(NimBLEUUID(gm_proto::SERVICE_UUID));
        // A directed advert reaching us is addressed to us: our old controller still holds the pairing (we lost NVS).
        const bool directedAtUs = advertisedDevice->getAdvType() == BLE_HCI_ADV_RPT_EVTYPE_DIR_IND;
        if (!gmService && !directedAtUs)
            return;
        // Skip open controllers locked to a different display (mixed-firmware safety net).
        if (gmService && isLockedToOther(advertisedDevice)) {
            ESP_LOGD(LOG_TAG, "Skipping controller %s (paired to another display)",
                     advertisedDevice->getAddress().toString().c_str());
            return;
        }
    }
    ESP_LOGI(LOG_TAG, "Found controller, ready to connect");
    _scanner->stop();
    // Value-copy the address now -- the device object is freed when this callback returns (see header note).
    _serverAddress = advertisedDevice->getAddress();
    _haveServerAddress = true;
    _readyForConnection = true;
}

bool BleClientTransport::isLockedToOther(NimBLEAdvertisedDevice *advertisedDevice) const {
    // Lock owner is broadcast as mfg data: 0xFFFF + paired display address in native order, zeros when unpaired.
    if (!advertisedDevice->haveManufacturerData())
        return false;
    const std::string mfg = advertisedDevice->getManufacturerData();
    if (mfg.length() != 8 || static_cast<uint8_t>(mfg[0]) != 0xFF || static_cast<uint8_t>(mfg[1]) != 0xFF)
        return false;
    static constexpr uint8_t zeros[6] = {0, 0, 0, 0, 0, 0};
    const uint8_t *owner = reinterpret_cast<const uint8_t *>(mfg.data()) + 2;
    if (memcmp(owner, zeros, sizeof(zeros)) == 0)
        return false; // open for pairing
    // Locked to us is fine (we lost NVS, controller kept the pairing); compare raw native bytes -- no NimBLEAddress round-trip.
    return memcmp(owner, NimBLEDevice::getAddress().getNative(), sizeof(zeros)) != 0;
}

void BleClientTransport::onDisconnect(NimBLEClient *client) {
    (void)client;
    ESP_LOGI(LOG_TAG, "Disconnected, will rescan");
    _writeChar = nullptr;
    _notifyChar = nullptr;
    _incompatible = false;
    emitConnection(false);
    scan();
}

void BleClientTransport::notifyCallback(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool) {
    (void)characteristic;
    emitData(data, length);
}
