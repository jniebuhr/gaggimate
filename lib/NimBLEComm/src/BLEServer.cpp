#include "BLEServer.h"

// Service and characteristic UUIDs
const char* BLETransportServer::SERVICE_UUID = "e75bc5b6-ff6e-4337-9d31-0c128f2e6e68";
const char* BLETransportServer::RX_CHAR_UUID = "12345678-1234-5678-1234-123456789abc";  // For receiving from client
const char* BLETransportServer::TX_CHAR_UUID = "87654321-4321-8765-4321-cba987654321";  // For sending to client
// Note: INFO_CHAR_UUID removed - using nanopb messages for system info

BLETransportServer::BLETransportServer() : deviceConnected(false), server(nullptr), service(nullptr), tx_char(nullptr), rx_char(nullptr) {
    // Constructor
}

BLETransportServer::~BLETransportServer() {
    if (server) {
        NimBLEDevice::deinit(true);
    }
}

void BLETransportServer::initServer(const String &deviceName) {
    Serial.printf("[BLEServer] Starting BLE server initialization...\n");
    Serial.flush();
    delay(2000);
    
    if (NimBLEDevice::getInitialized()) {
        Serial.printf("[BLEServer] BLE already initialized, skipping init\n");
        // Still need to setup server components
    } else {
        // Try a shorter device name in case there's a length issue
        String shortName = "GaggiMate-" + String(esp_random() % 1000);
        Serial.printf("[BLEServer] Calling NimBLEDevice::init() with name: %s\n", shortName.c_str());
        Serial.flush();
        
        // Initialize with the shorter name
        NimBLEDevice::init(shortName.c_str());
        NimBLEDevice::setMTU(256);  // Increase MTU to support larger messages
        Serial.printf("[BLEServer] BLE initialization completed successfully\n");
        Serial.flush();
    }

    // Create the BLE Server
    server = NimBLEDevice::createServer();
    server->setCallbacks(this);

    // Create the BLE Service  
    service = server->createService(SERVICE_UUID);

    // Create a BLE Characteristic for receiving data (RX)
    rx_char = service->createCharacteristic(
        RX_CHAR_UUID,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    rx_char->setCallbacks(this);

    // Create a BLE Characteristic for sending data (TX)
    tx_char = service->createCharacteristic(
        TX_CHAR_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );

    // Note: Removed info_char - using nanopb messages for system info instead

    // Start the service
    service->start();

    // Start advertising
    NimBLEAdvertising *advertising = NimBLEDevice::getAdvertising();
    advertising->addServiceUUID(SERVICE_UUID);
    advertising->setScanResponse(false);
    advertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
    NimBLEDevice::startAdvertising();
    
    Serial.println("[BLEServer] BLE server started successfully");
}

bool BLETransportServer::isConnected() const {
    return deviceConnected;
}

void BLETransportServer::startAdvertising() {
    if (server) {
        NimBLEDevice::startAdvertising();
    }
}

void BLETransportServer::stopAdvertising() {
    if (server) {
        NimBLEDevice::stopAdvertising();
    }
}

bool BLETransportServer::sendData(const uint8_t* data, size_t length) {
   
    if (!deviceConnected) {
        ESP_LOGE("BLEServer", "Cannot send data: device not connected");
        return false;
    }
    
    if (!tx_char) {
        ESP_LOGE("BLEServer", "Cannot send data: TX characteristic is null");
        return false;
    }
    
    if (length > 512) {  // Check for reasonable size limit
        ESP_LOGW("BLEServer", "Warning: Large message size: %d bytes", length);
    }
    
    tx_char->setValue(data, length);
    tx_char->notify();
    return true;
}

void BLETransportServer::registerDataCallback(const ble_data_callback_t& callback) {
    data_callback = callback;
}

void BLETransportServer::registerConnectionCallback(const ble_connection_callback_t& callback) {
    connection_callback = callback;
}

void BLETransportServer::setDeviceInfo(const String& info) {
    deviceInfo = info;
    ESP_LOGI("BLEServer", "Setting device info: '%s' (length: %d)", info.c_str(), info.length());
    // Note: BLE characteristic approach disabled - using nanopb messages instead
}

String BLETransportServer::getDeviceInfo() const {
    return deviceInfo;
}

void BLETransportServer::onConnect(NimBLEServer* pServer) {
    deviceConnected = true;
    Serial.printf("[BLEServer] Client connected, MTU: %d\n", pServer->getPeerMTU(0));
    if (connection_callback) {
        connection_callback(true);
    }
    // Restart advertising to allow multiple connections (if desired)
    // NimBLEDevice::startAdvertising();
}

void BLETransportServer::onDisconnect(NimBLEServer* pServer) {
    deviceConnected = false;
    if (connection_callback) {
        connection_callback(false);
    }
    startAdvertising(); // Resume advertising after disconnect
}

void BLETransportServer::onWrite(NimBLECharacteristic* pCharacteristic) {
    if (pCharacteristic == rx_char && data_callback) {
        std::string value = pCharacteristic->getValue();
        if (!value.empty()) {
            data_callback(reinterpret_cast<const uint8_t*>(value.data()), value.length());
        }
    }
}