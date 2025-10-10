#include "BLEClient.h"

// Service and characteristic UUIDs
const char* BLETransportClient::SERVICE_UUID = "e75bc5b6-ff6e-4337-9d31-0c128f2e6e68";
const char* BLETransportClient::RX_CHAR_UUID = "87654321-4321-8765-4321-cba987654321";  // For receiving from server
const char* BLETransportClient::TX_CHAR_UUID = "12345678-1234-5678-1234-123456789abc";  // For sending to server
// Note: INFO_CHAR_UUID removed - using nanopb messages for system info

// Static instance for callback handling
BLETransportClient* BLETransportClient::instance = nullptr;

#include "BLEClient.h"

BLETransportClient::BLETransportClient() : deviceConnected(false), client(nullptr) {
    Serial.println("[BLEClient] BLETransportClient constructor called");
    instance = this; // Set static instance for callback handling
}

BLETransportClient::~BLETransportClient() {
    if (instance == this) {
        instance = nullptr;
    }
    if (client) {
        NimBLEDevice::deleteClient(client);
    }
}

void BLETransportClient::initClient() {
    // Only initialize NimBLE if not already initialized
    bool isInitialized = NimBLEDevice::getInitialized();
    Serial.printf("[BLEClient] NimBLE already initialized: %s\n", isInitialized ? "true" : "false");
    
    if (!isInitialized) {
        Serial.printf("[BLEClient] Initializing NimBLE with device name: GaggiMate Display\n");
        NimBLEDevice::init("GaggiMate Display");
        NimBLEDevice::setPower(ESP_PWR_LVL_P9);
        NimBLEDevice::setMTU(256);  // Increase MTU to support larger messages
    } else {
        Serial.println("[BLEClient] NimBLE already initialized, skipping init");
    }
    
    client = NimBLEDevice::createClient();
    client->setClientCallbacks(this, false);
    client->setConnectionParams(12, 12, 0, 51);
    client->setConnectTimeout(5);
}

bool BLETransportClient::connectToServer() {
    if (!serverDevice || !client) {
        ESP_LOGW("BLEClient", "Cannot connect: serverDevice or client is null");
        return false;
    }
    
    // Check if serverDevice is stale (older than 30 seconds)
    if (millis() - serverDeviceFoundTime > 30000) {
        ESP_LOGW("BLEClient", "ServerDevice is stale, clearing and rescanning");
        serverDevice = nullptr;
        readyForConnection = false;
        return false;
    }
    
    // Validate serverDevice has a valid address
    NimBLEAddress addr = serverDevice->getAddress();
    if (addr.toString() == "00:00:00:00:00:00" || addr.toString().length() < 17) {
        ESP_LOGE("BLEClient", "Cannot connect: serverDevice has invalid address: %s", addr.toString().c_str());
        serverDevice = nullptr;
        readyForConnection = false;
        return false;
    }
    
    if (client->isConnected() && deviceConnected) {
        return true;
    }
    
    // Reset connection flag before attempting connection
    deviceConnected = false;
    
    if (!client->connect(serverDevice)) {
        return false;
    }
    
    // Check MTU after connection
    uint16_t mtu = client->getMTU();
    Serial.printf("[BLEClient] Connected to server, negotiated MTU: %d\n", mtu);
    
    // Get service
    NimBLERemoteService* pRemoteService = client->getService(SERVICE_UUID);
    if (!pRemoteService) {
        deviceConnected = false;
        client->disconnect();
        return false;
    }
    
    // Get characteristics
    rx_char = pRemoteService->getCharacteristic(RX_CHAR_UUID);
    tx_char = pRemoteService->getCharacteristic(TX_CHAR_UUID);
    // Note: info_char removed - using nanopb messages for system info
    
    if (!rx_char || !tx_char) {
        deviceConnected = false;
        client->disconnect();
        return false;
    }
    
    // Subscribe to notifications from server
    if (rx_char->canNotify()) {
        rx_char->subscribe(true, notifyCallback);
    }
    
    // Mark as connected only after successful setup
    deviceConnected = true;
    
    return true;
}

bool BLETransportClient::isConnected() const {
    // Use our own connection tracking for more reliable state management
    return deviceConnected && client && client->isConnected();
}

bool BLETransportClient::isReadyForConnection() const {
    return readyForConnection;
}

void BLETransportClient::scan() {
    if (!readyForConnection) {
        NimBLEScan* pBLEScan = NimBLEDevice::getScan();
        pBLEScan->setAdvertisedDeviceCallbacks(this);
        pBLEScan->setInterval(1349);
        pBLEScan->setWindow(449);
        pBLEScan->setActiveScan(true);
        pBLEScan->start(5, false);
    }
}

void BLETransportClient::disconnect() {
    deviceConnected = false;
    readyForConnection = false;
    serverDevice = nullptr;
    serverDeviceFoundTime = 0;
    if (client && client->isConnected()) {
        client->disconnect();
    }
}

bool BLETransportClient::sendData(const uint8_t* data, size_t length) {
    // Multiple layers of protection against race conditions
    if (!client || !tx_char) {
        return false;
    }
    
    // Double-check connection state to avoid race conditions
    if (!isConnected()) {
        return false;
    }
    
    // Add another check right before writing to catch rapid disconnections
    if (!client || !isConnected()) {
        return false;
    }
    
    // Final validation before writing to catch race conditions
    // Check all required components are still valid
    if (!client || !tx_char || !client->isConnected()) {
        return false;
    }
    
    // Validate the data parameters
    if (!data || length == 0) {
        return false;
    }
    
    // Attempt to write the value with explicit error checking
    bool writeSuccess = tx_char->writeValue(data, length);
    
    // If write failed, it could indicate connection issues
    if (!writeSuccess) {
        // Log the failure for debugging
        ESP_LOGW("BLEClient", "Failed to write value to characteristic");
        return false;
    }
    
    return true;
}

void BLETransportClient::registerDataCallback(const ble_data_callback_t& callback) {
    data_callback = callback;
}

void BLETransportClient::onResult(NimBLEAdvertisedDevice* advertisedDevice) {
    if (advertisedDevice->haveServiceUUID() && 
        advertisedDevice->isAdvertisingService(NimBLEUUID(SERVICE_UUID))) {
        
        NimBLEDevice::getScan()->stop();
        serverDevice = advertisedDevice;
        serverDeviceFoundTime = millis();
        readyForConnection = true;
        ESP_LOGI("BLEClient", "Found BLE server device: %s", advertisedDevice->getAddress().toString().c_str());
    }
}

void BLETransportClient::onConnect(NimBLEClient* pClient) {
    // Connection established
}

void BLETransportClient::onDisconnect(NimBLEClient* pClient) {
    // Reset connection flag on disconnection
    deviceConnected = false;
    readyForConnection = false;
    serverDevice = nullptr;
    serverDeviceFoundTime = 0;
    ESP_LOGI("BLEClient", "Connection lost, resetting state");
}

void BLETransportClient::handleNotifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, 
                                    uint8_t* pData, size_t length, bool isNotify) {
    if (data_callback) {
        data_callback(pData, length);
    }
}

void BLETransportClient::notifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, 
                              uint8_t* pData, size_t length, bool isNotify) {
    if (instance) {
        instance->handleNotifyCallback(pBLERemoteCharacteristic, pData, length, isNotify);
    }
}