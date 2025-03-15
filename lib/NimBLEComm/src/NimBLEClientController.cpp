#include "NimBLEClientController.h"

constexpr size_t MAX_CONNECT_RETRIES = 3;
constexpr size_t BLE_SCAN_DURATION_SECONDS = 10;

NimBLEClientController::NimBLEClientController()
    : client(nullptr), tempControlChar(nullptr), pumpControlChar(nullptr), valveControlChar(nullptr), altControlChar(nullptr),
      tempReadChar(nullptr), pingChar(nullptr), pidControlChar(nullptr), errorChar(nullptr), autotuneChar(nullptr),
      brewBtnChar(nullptr), steamBtnChar(nullptr), serverDevice(nullptr) {}

void NimBLEClientController::initClient() {
    NimBLEDevice::init("GPBLC");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Set to maximum power
    NimBLEDevice::setMTU(128);
    client = NimBLEDevice::createClient();
    if (client == nullptr)
        Serial.println("Failed to create BLE client");

    // Scan for BLE Server
    scan();
}

void NimBLEClientController::scan() {
    NimBLEScan *pBLEScan = NimBLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(this); // Use this class as the callback handler
    pBLEScan->setActiveScan(true);
    pBLEScan->start(BLE_SCAN_DURATION_SECONDS);
}

void NimBLEClientController::registerTempReadCallback(const temp_read_callback_t &callback) { tempReadCallback = callback; }

void NimBLEClientController::registerRemoteErrorCallback(const remote_err_callback_t &callback) {
    remoteErrorCallback = callback;
}

void NimBLEClientController::registerBrewBtnCallback(const brew_callback_t &callback) { brewBtnCallback = callback; }
void NimBLEClientController::registerSteamBtnCallback(const brew_callback_t &callback) { steamBtnCallback = callback; }

bool NimBLEClientController::connectToServer() {
    Serial.println("Connecting to advertised device");

    unsigned int tries = 0;
    while (!client->isConnected()) {
        if (!client->connect(NimBLEAddress(serverDevice->getAddress()))) {
            Serial.println("Failed connecting to BLE server. Retrying...");
        }

        tries++;

        if (tries >= MAX_CONNECT_RETRIES) {
            Serial.println("Connection timeout! Unable to connect to BLE server.");
            scan();
            return false; // Exit the connection attempt if timed out
        }

        delay(500); // Add a small delay to avoid busy-waiting
    }

    Serial.println("Successfully connected to BLE server");

    // Obtain the remote service we wish to connect to
    NimBLERemoteService *pRemoteService = client->getService(NimBLEUUID(SERVICE_UUID));
    if (pRemoteService == nullptr) {
        Serial.println("Error getting remote service");
        return false;
    }

    // Obtain the remote write characteristics
    tempControlChar = pRemoteService->getCharacteristic(NimBLEUUID(TEMP_CONTROL_CHAR_UUID));
    pumpControlChar = pRemoteService->getCharacteristic(NimBLEUUID(PUMP_CONTROL_CHAR_UUID));
    valveControlChar = pRemoteService->getCharacteristic(NimBLEUUID(VALVE_CONTROL_CHAR_UUID));
    altControlChar = pRemoteService->getCharacteristic(NimBLEUUID(ALT_CONTROL_CHAR_UUID));
    autotuneChar = pRemoteService->getCharacteristic(NimBLEUUID(AUTOTUNE_CHAR_UUID));
    pingChar = pRemoteService->getCharacteristic(NimBLEUUID(PING_CHAR_UUID));
    pidControlChar = pRemoteService->getCharacteristic(NimBLEUUID(PID_CONTROL_CHAR_UUID));

    // Obtain the remote notify characteristic and subscribe to it
    tempReadChar = pRemoteService->getCharacteristic(NimBLEUUID(TEMP_READ_CHAR_UUID));
    if (tempReadChar->canNotify()) {
        tempReadChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                                std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    errorChar = pRemoteService->getCharacteristic(NimBLEUUID(ERROR_CHAR_UUID));
    if (errorChar->canNotify()) {
        errorChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                             std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    brewBtnChar = pRemoteService->getCharacteristic(NimBLEUUID(BREW_BTN_UUID));
    if (brewBtnChar->canNotify()) {
        brewBtnChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                               std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    steamBtnChar = pRemoteService->getCharacteristic(NimBLEUUID(STEAM_BTN_UUID));
    if (steamBtnChar->canNotify()) {
        steamBtnChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                                std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    delay(500);

    readyForConnection = false;
    return true;
}

void NimBLEClientController::sendTemperatureControl(float setpoint) {
    if (tempControlChar != nullptr && client->isConnected()) {
        char tempStr[8];
        snprintf(tempStr, sizeof(tempStr), "%.2f", setpoint);
        tempControlChar->writeValue(tempStr);
    }
}

void NimBLEClientController::sendPidSettings(const String &pid) {
    if (pidControlChar != nullptr && client->isConnected()) {
        pidControlChar->writeValue(pid);
    }
}

void NimBLEClientController::sendPumpControl(float setpoint) {
    if (pumpControlChar != nullptr && client->isConnected()) {
        char pumpStr[8];
        snprintf(pumpStr, sizeof(pumpStr), "%.2f", setpoint);
        pumpControlChar->writeValue(pumpStr);
    }
}

void NimBLEClientController::sendValveControl(bool pinState) {
    if (valveControlChar != nullptr && client->isConnected()) {
        valveControlChar->writeValue(pinState ? "1" : "0");
    }
}

void NimBLEClientController::sendAltControl(bool pinState) {
    if (altControlChar != nullptr && client->isConnected()) {
        altControlChar->writeValue(pinState ? "1" : "0");
    }
}

void NimBLEClientController::sendPing() {
    if (pingChar != nullptr && client->isConnected()) {
        pingChar->writeValue("1");
    }
}

void NimBLEClientController::sendAutotune() {
    if (autotuneChar != nullptr && client->isConnected()) {
        autotuneChar->writeValue("1");
    }
}

bool NimBLEClientController::isReadyForConnection() const { return readyForConnection; }

bool NimBLEClientController::isConnected() { return client->isConnected(); }

// BLEAdvertisedDeviceCallbacks override
void NimBLEClientController::onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    Serial.printf("Advertised Device found: %s \n", advertisedDevice->toString().c_str());

    // Check if this is the device we're looking for
    if (advertisedDevice->haveServiceUUID()) {
        Serial.println("Found BLE service. Checking for ID...");
        if (advertisedDevice->isAdvertisingService(NimBLEUUID(SERVICE_UUID))) {
            Serial.println("Found target BLE device. Connecting...");
            NimBLEDevice::getScan()->stop(); // Stop scanning once we find the correct device
            serverDevice = advertisedDevice;
            readyForConnection = true;
        }
    }
}

void NimBLEClientController::onDisconnect(NimBLEClient *pServer) {
    Serial.println("Disconnected from server, trying to reconnect...");
    scan();
}

// Notification callback
void NimBLEClientController::notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t,
                                            bool) const {
    // Process notifications from the server (e.g., temperature data)
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(TEMP_READ_CHAR_UUID))) {
        float temperature = atof((char *)pData);
        Serial.printf("Temperature read: %.2f\n", temperature);
        if (tempReadCallback != nullptr) {
            tempReadCallback(temperature);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(ERROR_CHAR_UUID))) {
        int errorCode = atoi((char *)pData);
        Serial.printf("Error read: %d\n", errorCode);
        if (remoteErrorCallback != nullptr) {
            remoteErrorCallback(errorCode);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(BREW_BTN_UUID))) {
        int brewButtonStatus = atoi((char *)pData);
        Serial.printf("brew button: %d\n", brewButtonStatus);
        if (brewBtnCallback != nullptr) {
            brewBtnCallback(brewButtonStatus);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(STEAM_BTN_UUID))) {
        int steamButtonStatus = atoi((char *)pData);
        Serial.printf("steam button: %d\n", steamButtonStatus);
        if (steamBtnCallback != nullptr) {
            steamBtnCallback(steamButtonStatus);
        }
    }
}
