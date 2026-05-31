#include "BleServerTransport.h"

void BleServerTransport::init(const String &deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    // esp-nimble-cpp (NimBLE 2.x): setPower takes int8_t dBm, not the enum.
    // ESP_PWR_LVL_P9 (=11 on ESP32-S3) would quantize to +12 dBm; 9 = +9 dBm.
    NimBLEDevice::setPower(9);
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
    _advertising->enableScanResponse(true); // 2.x renamed setScanResponse
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
    _txChar->notify(); // 2.x notify() returns bool; fire-and-forget here
    return true;
}

bool BleServerTransport::isConnected() const { return _connected; }

void BleServerTransport::onConnect(NimBLEServer *server, NimBLEConnInfo &connInfo) {
    (void)connInfo;
    _connected = true;
    server->stopAdvertising();
    ESP_LOGI(LOG_TAG, "Client connected");
    emitConnection(true);
}

void BleServerTransport::onDisconnect(NimBLEServer *server, NimBLEConnInfo &connInfo, int reason) {
    (void)connInfo;
    (void)reason;
    _connected = false;
    ESP_LOGI(LOG_TAG, "Client disconnected");
    emitConnection(false);
    server->startAdvertising();
}

void BleServerTransport::onWrite(NimBLECharacteristic *characteristic, NimBLEConnInfo &connInfo) {
    (void)connInfo;
    if (characteristic != _rxChar)
        return;
    NimBLEAttValue value = characteristic->getValue();
    if (value.length() > 0)
        emitData(value.data(), value.length());
}

void BleServerTransport::onSubscribe(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo &connInfo, uint16_t subValue) {
    (void)pCharacteristic;
    (void)connInfo;
    (void)subValue;
    emitConnection(true);
}
