#include "BleServerTransport.h"

void BleServerTransport::init(const String &deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    NimBLEDevice::setMTU(256); // headroom for batched frames

    _server = NimBLEDevice::createServer();
    _server->setCallbacks(this);

    NimBLEService *service = _server->createService(gm_proto::SERVICE_UUID);
    _rxChar = service->createCharacteristic(gm_proto::RX_CHAR_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
    _rxChar->setCallbacks(this);
    _txChar = service->createCharacteristic(gm_proto::TX_CHAR_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
    _txChar->setCallbacks(this);
    _infoChar = service->createCharacteristic(gm_proto::INFO_CHAR_UUID, NIMBLE_PROPERTY::READ);
    _infoChar->setValue(std::string(_info.c_str()));
    service->start();

    // OTA DFU shares the same server (separate service/UUIDs).
    _otaDfu.configure_OTA(_server);
    _otaDfu.start_OTA();

    _advertising = NimBLEDevice::getAdvertising();
    _advertising->addServiceUUID(gm_proto::SERVICE_UUID);
    _advertising->setScanResponse(true);
    _advertising->start();
    ESP_LOGI(LOG_TAG, "BLE server started, advertising");
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
    if (desc)
        _connHandle = desc->conn_handle;
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
