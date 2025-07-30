#include "NimBLEClientController.h"

constexpr size_t MAX_CONNECT_RETRIES = 3;
constexpr size_t BLE_SCAN_DURATION_SECONDS = 10;

NimBLEClientController::NimBLEClientController() : client(nullptr) {}

void NimBLEClientController::initClient() {
    NimBLEDevice::init("GPBLC");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Set to maximum power
    NimBLEDevice::setMTU(128);
    client = NimBLEDevice::createClient();
    client->setClientCallbacks(this);
    if (client == nullptr)
        ESP_LOGE(LOG_TAG, "Failed to create BLE client");

    // Scan for BLE Server
    scan();
}

void NimBLEClientController::scan() {
    NimBLEScan *pBLEScan = NimBLEDevice::getScan();
    pBLEScan->clearDuplicateCache();
    pBLEScan->setAdvertisedDeviceCallbacks(this); // Use this class as the callback handler
    pBLEScan->setActiveScan(true);
    pBLEScan->start(BLE_SCAN_DURATION_SECONDS, nullptr, false);
}

void NimBLEClientController::tare() {
    if (volumetricTareChar != nullptr && client->isConnected()) {
        volumetricTareChar->writeValue("1");
    }
}

void NimBLEClientController::registerRemoteErrorCallback(const remote_err_callback_t &callback) {
    remoteErrorCallback = callback;
}
void NimBLEClientController::registerBrewBtnCallback(const brew_callback_t &callback) { brewBtnCallback = callback; }
void NimBLEClientController::registerSteamBtnCallback(const brew_callback_t &callback) { steamBtnCallback = callback; }

void NimBLEClientController::registerSensorCallback(const sensor_read_callback_t &callback) { sensorCallback = callback; }

void NimBLEClientController::registerAutotuneResultCallback(const pid_control_callback_t &callback) {
    autotuneResultCallback = callback;
}

void NimBLEClientController::registerVolumetricMeasurementCallback(const float_callback_t &callback) {
    volumetricMeasurementCallback = callback;
}

void NimBLEClientController::registerTofMeasurementCallback(const int_callback_t &callback) { tofMeasurementCallback = callback; }

std::string NimBLEClientController::readInfo() const {
    if (infoChar != nullptr && infoChar->canRead()) {
        return infoChar->readValue();
    }
    return "";
}

bool NimBLEClientController::connectToServer() {
    ESP_LOGI(LOG_TAG, "Connecting to advertised device");

    unsigned int tries = 0;
    while (!client->isConnected()) {
        if (!client->connect(NimBLEAddress(serverDevice->getAddress()))) {
            ESP_LOGE(LOG_TAG, "Failed connecting to BLE server. Retrying...");
        }

        tries++;

        if (tries >= MAX_CONNECT_RETRIES) {
            ESP_LOGE(LOG_TAG, "Connection timeout! Unable to connect to BLE server.");
            scan();
            return false; // Exit the connection attempt if timed out
        }

        delay(500); // Add a small delay to avoid busy-waiting
    }
    client->updateConnParams(6, 8, 0, 400);

    ESP_LOGI(LOG_TAG, "Successfully connected to BLE server");

    // Obtain the remote service we wish to connect to
    NimBLERemoteService *pRemoteService = client->getService(NimBLEUUID(SERVICE_UUID));
    if (pRemoteService == nullptr) {
        ESP_LOGE(LOG_TAG, "Error getting remote service");
        return false;
    }

    // Obtain the remote write characteristics
    outputControlChar = pRemoteService->getCharacteristic(NimBLEUUID(OUTPUT_CONTROL_UUID));
    altControlChar = pRemoteService->getCharacteristic(NimBLEUUID(ALT_CONTROL_CHAR_UUID));
    autotuneChar = pRemoteService->getCharacteristic(NimBLEUUID(AUTOTUNE_CHAR_UUID));
    pingChar = pRemoteService->getCharacteristic(NimBLEUUID(PING_CHAR_UUID));
    pidControlChar = pRemoteService->getCharacteristic(NimBLEUUID(PID_CONTROL_CHAR_UUID));
    infoChar = pRemoteService->getCharacteristic(NimBLEUUID(INFO_UUID));
    pressureScaleChar = pRemoteService->getCharacteristic(NimBLEUUID(PRESSURE_SCALE_UUID));
    volumetricTareChar = pRemoteService->getCharacteristic(NimBLEUUID(VOLUMETRIC_TARE_UUID));
    ledControlChar = pRemoteService->getCharacteristic(NimBLEUUID(LED_CONTROL_UUID));

    // Obtain the remote notify characteristic and subscribe to it

    errorChar = pRemoteService->getCharacteristic(NimBLEUUID(ERROR_CHAR_UUID));
    if (errorChar->canNotify()) {
        errorChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                             std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    brewBtnChar = pRemoteService->getCharacteristic(NimBLEUUID(BREW_BTN_UUID));
    if (brewBtnChar != nullptr && brewBtnChar->canNotify()) {
        brewBtnChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                               std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    steamBtnChar = pRemoteService->getCharacteristic(NimBLEUUID(STEAM_BTN_UUID));
    if (steamBtnChar != nullptr && steamBtnChar->canNotify()) {
        steamBtnChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                                std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    autotuneResultChar = pRemoteService->getCharacteristic(NimBLEUUID(AUTOTUNE_RESULT_UUID));
    if (autotuneResultChar != nullptr && autotuneResultChar->canNotify()) {
        autotuneResultChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                                      std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    sensorChar = pRemoteService->getCharacteristic(NimBLEUUID(SENSOR_DATA_UUID));
    if (sensorChar != nullptr && sensorChar->canNotify()) {
        sensorChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                              std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    volumetricMeasurementChar = pRemoteService->getCharacteristic(NimBLEUUID(VOLUMETRIC_MEASUREMENT_UUID));
    if (volumetricMeasurementChar != nullptr && volumetricMeasurementChar->canNotify()) {
        volumetricMeasurementChar->subscribe(true,
                                             std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                                       std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    tofMeasurementChar = pRemoteService->getCharacteristic(NimBLEUUID(TOF_MEASUREMENT_UUID));
    if (tofMeasurementChar != nullptr && tofMeasurementChar->canNotify()) {
        tofMeasurementChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                                      std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    delay(500);

    readyForConnection = false;
    return true;
}

void NimBLEClientController::sendAdvancedOutputControl(bool valve, float boilerSetpoint, bool pressureTarget, float pressure,
                                                       float flow) {
    if (client->isConnected() && outputControlChar != nullptr) {
        char str[30];
        snprintf(str, sizeof(str), "%d,%d,%.1f,%.1f,%d,%.2f,%.2f", 1, valve ? 1 : 0, 100.0f, boilerSetpoint,
                 pressureTarget ? 1 : 0, pressure, flow);
        _lastOutputControl = String(str);
        outputControlChar->writeValue(_lastOutputControl, false);
    }
}

void NimBLEClientController::sendOutputControl(bool valve, float pumpSetpoint, float boilerSetpoint) {
    if (client->isConnected() && outputControlChar != nullptr) {
        char str[30];
        snprintf(str, sizeof(str), "%d,%d,%.1f,%.1f", 0, valve ? 1 : 0, pumpSetpoint, boilerSetpoint);
        _lastOutputControl = String(str);
        outputControlChar->writeValue(_lastOutputControl, false);
    }
}

void NimBLEClientController::sendPidSettings(const String &pid) {
    if (pidControlChar != nullptr && client->isConnected()) {
        pidControlChar->writeValue(pid);
    }
}

void NimBLEClientController::setPressureScale(float scale) {
    if (client->isConnected() && pressureScaleChar != nullptr) {
        pressureScaleChar->writeValue(String(scale));
    }
}

void NimBLEClientController::sendLedControl(uint8_t channel, uint8_t brightness) {
    if (client->isConnected() && ledControlChar != nullptr) {
        ledControlChar->writeValue(String(channel) + "," + String(brightness));
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

void NimBLEClientController::sendAutotune(int testTime, int samples) {
    if (autotuneChar != nullptr && client->isConnected()) {
        char autotuneStr[20];
        snprintf(autotuneStr, sizeof(autotuneStr), "%d,%d", testTime, samples);
        autotuneChar->writeValue(autotuneStr);
    }
}

bool NimBLEClientController::isReadyForConnection() const { return readyForConnection; }

bool NimBLEClientController::isConnected() { return client->isConnected(); }

// BLEAdvertisedDeviceCallbacks override
void NimBLEClientController::onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    ESP_LOGV(LOG_TAG, "Advertised Device found: %s \n", advertisedDevice->toString().c_str());

    // Check if this is the device we're looking for
    if (advertisedDevice->haveServiceUUID()) {
        ESP_LOGI(LOG_TAG, "Found BLE service. Checking for ID...");
        if (advertisedDevice->isAdvertisingService(NimBLEUUID(SERVICE_UUID))) {
            ESP_LOGI(LOG_TAG, "Found target BLE device. Connecting...");
            NimBLEDevice::getScan()->stop(); // Stop scanning once we find the correct device
            serverDevice = advertisedDevice;
            readyForConnection = true;
        }
    }
}

void NimBLEClientController::onDisconnect(NimBLEClient *pServer) {
    ESP_LOGI(LOG_TAG, "Disconnected from server, trying to reconnect...");
    scan();
}

// Notification callback
void NimBLEClientController::notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t,
                                            bool) const {
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(ERROR_CHAR_UUID))) {
        int errorCode = atoi((char *)pData);
        ESP_LOGV(LOG_TAG, "Error read: %d", errorCode);
        if (remoteErrorCallback != nullptr) {
            remoteErrorCallback(errorCode);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(BREW_BTN_UUID))) {
        int brewButtonStatus = atoi((char *)pData);
        ESP_LOGV(LOG_TAG, "brew button: %d", brewButtonStatus);
        if (brewBtnCallback != nullptr) {
            brewBtnCallback(brewButtonStatus);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(STEAM_BTN_UUID))) {
        int steamButtonStatus = atoi((char *)pData);
        ESP_LOGV(LOG_TAG, "steam button: %d", steamButtonStatus);
        if (steamBtnCallback != nullptr) {
            steamBtnCallback(steamButtonStatus);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(SENSOR_DATA_UUID))) {
        String data = String((char *)pData);
        float temperature = get_token(data, 0, ',').toFloat();
        float pressure = get_token(data, 1, ',').toFloat();
        float puckFlow = get_token(data, 2, ',').toFloat();
        float pumpFlow = get_token(data, 3, ',').toFloat();

        ESP_LOGV(LOG_TAG, "Received sensor data: temperature=%.1f, pressure=%.1f, puck_flow=%.1f, pump_flow=%.1f", temperature,
                 pressure, puckFlow, pumpFlow);
        if (sensorCallback != nullptr) {
            sensorCallback(temperature, pressure, puckFlow, pumpFlow);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(AUTOTUNE_RESULT_UUID))) {
        String settings = String((char *)pData);
        ESP_LOGV(LOG_TAG, "autotune result: %s", settings.c_str());
        if (autotuneResultCallback != nullptr) {
            float Kp = get_token(settings, 0, ',').toFloat();
            float Ki = get_token(settings, 1, ',').toFloat();
            float Kd = get_token(settings, 2, ',').toFloat();
            autotuneResultCallback(Kp, Ki, Kd);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(VOLUMETRIC_MEASUREMENT_UUID))) {
        float value = atof((char *)pData);
        ESP_LOGV(LOG_TAG, "Volumetric measurement: %.2f", value);
        if (volumetricMeasurementCallback != nullptr) {
            volumetricMeasurementCallback(value);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(TOF_MEASUREMENT_UUID))) {
        int value = atoi((char *)pData);
        ESP_LOGV(LOG_TAG, "ToF measurement: %.2f", value);
        if (tofMeasurementCallback != nullptr) {
            tofMeasurementCallback(value);
        }
    }
}
