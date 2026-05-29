#include "BleClientTransport.h"

void BleClientTransport::init(const String &deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setMTU(256);
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
    // BLE and Wi-Fi share the single 2.4 GHz radio. A low-duty passive scan
    // (1.25% duty, listen-only) keeps Wi-Fi RTT responsive; discovery is a touch
    // slower but still reliable. (Carried over from the previous transport.)
    _scanner->setInterval(4000);
    _scanner->setWindow(50);
    _scanner->setMaxResults(0);
    _scanner->setDuplicateFilter(false);
    _scanner->setActiveScan(false);
    _scanner->start(0, nullptr, false); // 0 = continuous
}

void BleClientTransport::maintain() {
    if (!_readyForConnection && !_client->isConnected() && !_scanner->isScanning()) {
        ESP_LOGI(LOG_TAG, "Scan stalled, restarting");
        scan();
    }
}

bool BleClientTransport::connectToServer() {
    if (_serverDevice == nullptr)
        return false;

    ESP_LOGI(LOG_TAG, "Connecting to advertised device");
    unsigned int tries = 0;
    do {
        if (tries >= MAX_CONNECT_RETRIES) {
            ESP_LOGE(LOG_TAG, "Connection timeout, rescanning");
            scan();
            return false;
        }
        if (!_client->connect(NimBLEAddress(_serverDevice->getAddress()))) {
            ESP_LOGW(LOG_TAG, "Connect failed, retrying");
            delay(500);
        }
        tries++;
    } while (!_client->isConnected());
    _client->updateConnParams(6, 8, 0, 400);

    NimBLERemoteService *service = _client->getService(NimBLEUUID(gm_proto::SERVICE_UUID));
    if (service == nullptr) {
        ESP_LOGE(LOG_TAG, "Service not found");
        scan();
        return false;
    }

    _writeChar = service->getCharacteristic(NimBLEUUID(gm_proto::RX_CHAR_UUID));
    _notifyChar = service->getCharacteristic(NimBLEUUID(gm_proto::TX_CHAR_UUID));
    if (_writeChar == nullptr || _notifyChar == nullptr) {
        ESP_LOGE(LOG_TAG, "Characteristics not found");
        _client->disconnect();
        scan();
        return false;
    }

    if (_notifyChar->canNotify()) {
        _notifyChar->subscribe(true, std::bind(&BleClientTransport::notifyCallback, this, std::placeholders::_1,
                                               std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    _readyForConnection = false;
    ESP_LOGI(LOG_TAG, "Connected, MTU: %d", _client->getMTU());
    emitConnection(true);
    return true;
}

void BleClientTransport::disconnect() {
    _readyForConnection = false;
    _serverDevice = nullptr;
    if (_client && _client->isConnected())
        _client->disconnect();
}

bool BleClientTransport::send(const uint8_t *data, size_t length) {
    if (!isConnected() || _writeChar == nullptr || data == nullptr || length == 0)
        return false;
    return _writeChar->writeValue(data, length, false); // write without response
}

bool BleClientTransport::isConnected() const { return _client != nullptr && _client->isConnected(); }

void BleClientTransport::onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    if (!advertisedDevice->haveServiceUUID())
        return;
    if (advertisedDevice->isAdvertisingService(NimBLEUUID(gm_proto::SERVICE_UUID))) {
        ESP_LOGI(LOG_TAG, "Found controller, ready to connect");
        _scanner->stop();
        _serverDevice = advertisedDevice;
        _readyForConnection = true;
    }
}

void BleClientTransport::onDisconnect(NimBLEClient *client) {
    (void)client;
    ESP_LOGI(LOG_TAG, "Disconnected, will rescan");
    _writeChar = nullptr;
    _notifyChar = nullptr;
    emitConnection(false);
    scan();
}

void BleClientTransport::notifyCallback(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool) {
    (void)characteristic;
    emitData(data, length);
}
