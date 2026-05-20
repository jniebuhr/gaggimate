#include "NimBLEClientController.h"
#include <cstdio>

constexpr size_t MAX_CONNECT_RETRIES = 3;

NimBLEClientController::NimBLEClientController() : client(nullptr) {}

void NimBLEClientController::initClient() {
    NimBLEDevice::init("GPBLC");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Set to maximum power
    NimBLEDevice::setMTU(128);
    client = NimBLEDevice::createClient();
    scanner = NimBLEDevice::getScan();
    if (client == nullptr) {
        ESP_LOGE(LOG_TAG, "Failed to create BLE client");
        return;
    }
    client->setClientCallbacks(this);

    // Scan for BLE Server
    scan();
    xTaskCreate(loopTask, "NimBLEClientController::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void NimBLEClientController::scan() {
    readyForConnection = false;
    scanner->clearDuplicateCache();
    scanner->setAdvertisedDeviceCallbacks(this, true);
    scanner->setInterval(2000);
    scanner->setWindow(100);
    scanner->setMaxResults(0);
    scanner->setDuplicateFilter(false);
    scanner->setActiveScan(true);
    scanner->start(0, nullptr, false); // Set to 0 for continuous
}

void NimBLEClientController::tare() {
    if (volumetricTareChar != nullptr && client->isConnected()) {
        volumetricTareChar->writeValue("1");
    }
}

void NimBLEClientController::registerRemoteErrorCallback(const remote_err_callback_t &callback) {
    remoteErrorCallback = callback;
}

void NimBLEClientController::registerBtnCallback(const button_callback_t &callback) { btnCallback = callback; }

void NimBLEClientController::registerLevelCallback(const bool_callback_t &callback) { levelCallback = callback; }

void NimBLEClientController::registerSensorCallback(const sensor_read_callback_t &callback) { sensorCallback = callback; }

void NimBLEClientController::registerAutotuneResultCallback(const pid_control_callback_t &callback) {
    autotuneResultCallback = callback;
}

void NimBLEClientController::registerVolumetricMeasurementCallback(const float_callback_t &callback) {
    volumetricMeasurementCallback = callback;
}

void NimBLEClientController::registerTofMeasurementCallback(const int_callback_t &callback) { tofMeasurementCallback = callback; }

void NimBLEClientController::registerDisconnectCallback(const void_callback_t &callback) { disconnectCallback = callback; }

std::string NimBLEClientController::readInfo() const {
    if (infoChar != nullptr && infoChar->canRead()) {
        return infoChar->readValue();
    }
    return "";
}

bool NimBLEClientController::connectToServer() {
    ESP_LOGI(LOG_TAG, "Connecting to advertised device");

    unsigned int tries = 0;
    do {
        if (tries >= MAX_CONNECT_RETRIES) {
            ESP_LOGE(LOG_TAG, "Connection timeout! Unable to connect to BLE server.");
            scan();
            return false; // Exit the connection attempt if timed out
        }

        if (!client->connect(NimBLEAddress(serverDevice->getAddress()))) {
            ESP_LOGE(LOG_TAG, "Failed connecting to BLE server. Retrying...");
            delay(500); // Add a small delay to avoid busy-waiting
        }

        tries++;
    } while (!client->isConnected());
    client->updateConnParams(6, 8, 0, 400);

    ESP_LOGI(LOG_TAG, "Successfully connected to BLE server");

    // Obtain the remote service we wish to connect to
    NimBLERemoteService *pRemoteService = client->getService(NimBLEUUID(SERVICE_UUID));
    if (pRemoteService == nullptr) {
        ESP_LOGE(LOG_TAG, "Error getting remote service");
        scan();
        return false;
    }

    // Obtain the remote write characteristics
    outputControlChar = pRemoteService->getCharacteristic(NimBLEUUID(OUTPUT_CONTROL_UUID));
    altControlChar = pRemoteService->getCharacteristic(NimBLEUUID(ALT_CONTROL_CHAR_UUID));
    autotuneChar = pRemoteService->getCharacteristic(NimBLEUUID(AUTOTUNE_CHAR_UUID));
    pingChar = pRemoteService->getCharacteristic(NimBLEUUID(PING_CHAR_UUID));
    pidControlChar = pRemoteService->getCharacteristic(NimBLEUUID(PID_CONTROL_CHAR_UUID));
    pumpModelCoeffsChar = pRemoteService->getCharacteristic(NimBLEUUID(PUMP_MODEL_COEFFS_CHAR_UUID));
    infoChar = pRemoteService->getCharacteristic(NimBLEUUID(INFO_UUID));
    pressureScaleChar = pRemoteService->getCharacteristic(NimBLEUUID(PRESSURE_SCALE_UUID));
    volumetricTareChar = pRemoteService->getCharacteristic(NimBLEUUID(VOLUMETRIC_TARE_UUID));
    ledControlChar = pRemoteService->getCharacteristic(NimBLEUUID(LED_CONTROL_UUID));

    // Obtain the remote notify characteristic and subscribe to it

    errorChar = pRemoteService->getCharacteristic(NimBLEUUID(ERROR_CHAR_UUID));
    if (errorChar != nullptr && errorChar->canNotify()) {
        errorChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                             std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    btnChar = pRemoteService->getCharacteristic(NimBLEUUID(BTN_UUID));
    if (btnChar != nullptr && btnChar->canNotify()) {
        btnChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
                                           std::placeholders::_2, std::placeholders::_3, std::placeholders::_4));
    }

    levelChar = pRemoteService->getCharacteristic(NimBLEUUID(WATER_LEVEL_UUID));
    if (levelChar != nullptr && levelChar->canNotify()) {
        levelChar->subscribe(true, std::bind(&NimBLEClientController::notifyCallback, this, std::placeholders::_1,
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

void NimBLEClientController::loop() {
    if (!readyForConnection && !client->isConnected() && !scanner->isScanning()) {
        ESP_LOGI("NimBLEClientController", "Scan interrupted. Restarting...");
        scan();
    }
}

void NimBLEClientController::sendAdvancedOutputControl(bool valve, float heaterSetpoint, bool pressureTarget, float pressure,
                                                       float flow, bool refill, float heater2Setpoint) {
    if (client->isConnected() && outputControlChar != nullptr) {
        snprintf(advancedOutputBuffer, sizeof(advancedOutputBuffer), "1,%d,100.0,%.3f,%d,%.3f,%.3f,%d,%.3f", valve ? 1 : 0,
                 heaterSetpoint, pressureTarget ? 1 : 0, pressure, flow, refill ? 1 : 0, heater2Setpoint);
        _lastOutputControl = String(advancedOutputBuffer);
        outputControlChar->writeValue(_lastOutputControl, false);
    }
}

void NimBLEClientController::sendOutputControl(bool valve, float pumpSetpoint, float heaterSetpoint, bool refill,
                                               float heater2Setpoint) {
    if (client->isConnected() && outputControlChar != nullptr) {
        snprintf(outputBuffer, sizeof(outputBuffer), "0,%d,%.3f,%.3f,%d,%.3f", valve ? 1 : 0, pumpSetpoint, heaterSetpoint,
                 refill ? 1 : 0, heater2Setpoint);
        _lastOutputControl = String(outputBuffer);
        outputControlChar->writeValue(_lastOutputControl, false);
    }
}

void NimBLEClientController::sendPidSettings(const String &pid) {
    if (pidControlChar != nullptr && client->isConnected()) {
        pidControlChar->writeValue(pid);
    }
}

void NimBLEClientController::sendPumpModelCoeffs(const String &pumpModelCoeffs) {
    if (pumpModelCoeffsChar != nullptr && client->isConnected()) {
        pumpModelCoeffsChar->writeValue(pumpModelCoeffs);
    }
}

void NimBLEClientController::setPressureScale(float scale) {
    if (client->isConnected() && pressureScaleChar != nullptr) {
        snprintf(pressureScaleBuffer, sizeof(pressureScaleBuffer), "%.3f", scale);
        pressureScaleChar->writeValue(pressureScaleBuffer);
    }
}

void NimBLEClientController::sendLedControl(uint8_t channel, uint8_t brightness) {
    if (client->isConnected() && ledControlChar != nullptr) {
        ledControlChar->writeValue(String(channel) + "," + String(brightness), false);
    }
}

void NimBLEClientController::sendAltControl(bool pinState) {
    if (altControlChar != nullptr && client->isConnected()) {
        altControlChar->writeValue(pinState ? "1" : "0");
    }
}

void NimBLEClientController::sendPing() {
    if (pingChar != nullptr && client->isConnected()) {
        pingChar->writeValue("1", false);
    }
}

void NimBLEClientController::sendAutotune(int testTime, int samples) {
    if (autotuneChar != nullptr && client->isConnected()) {
        snprintf(autotuneBuffer, sizeof(autotuneBuffer), "%d,%d", testTime, samples);
        autotuneChar->writeValue(autotuneBuffer);
    }
}

bool NimBLEClientController::isReadyForConnection() const { return readyForConnection; }

bool NimBLEClientController::isConnected() { return client != nullptr && client->isConnected(); }

// BLEAdvertisedDeviceCallbacks override
void NimBLEClientController::onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    ESP_LOGV(LOG_TAG, "Advertised Device found: %s \n", advertisedDevice->toString().c_str());

    // Check if this is the device we're looking for
    if (advertisedDevice->haveServiceUUID()) {
        ESP_LOGI(LOG_TAG, "Found BLE service. Checking for ID...");
        if (advertisedDevice->isAdvertisingService(NimBLEUUID(SERVICE_UUID))) {
            ESP_LOGI(LOG_TAG, "Found target BLE device. Connecting...");
            scanner->stop();
            serverDevice = advertisedDevice;
            readyForConnection = true;
        }
    }
}

void NimBLEClientController::onDisconnect(NimBLEClient *pServer) {
    ESP_LOGI(LOG_TAG, "Disconnected from server, trying to reconnect...");
    tempControlChar = nullptr;
    pumpControlChar = nullptr;
    valveControlChar = nullptr;
    altControlChar = nullptr;
    tempReadChar = nullptr;
    pingChar = nullptr;
    pidControlChar = nullptr;
    pumpModelCoeffsChar = nullptr;
    errorChar = nullptr;
    autotuneChar = nullptr;
    autotuneResultChar = nullptr;
    btnChar = nullptr;
    infoChar = nullptr;
    sensorChar = nullptr;
    outputControlChar = nullptr;
    pressureScaleChar = nullptr;
    volumetricMeasurementChar = nullptr;
    volumetricTareChar = nullptr;
    ledControlChar = nullptr;
    tofMeasurementChar = nullptr;
    if (disconnectCallback != nullptr) {
        disconnectCallback();
    }
    scan();
}

// Notification callback
void NimBLEClientController::notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length,
                                            bool) const {
    char rawData[129];
    size_t copyLength = length < (sizeof(rawData) - 1) ? length : (sizeof(rawData) - 1);
    memcpy(rawData, pData, copyLength);
    rawData[copyLength] = '\0';

    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(ERROR_CHAR_UUID))) {
        int errorCode = atoi(rawData);
        ESP_LOGV(LOG_TAG, "Error read: %d", errorCode);
        if (remoteErrorCallback != nullptr) {
            remoteErrorCallback(errorCode);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(BTN_UUID))) {
        int index = 0;
        int status = 0;

        int parsed = sscanf(rawData, "%d,%d", &index, &status);
        if (parsed < 2) {
            ESP_LOGW(LOG_TAG, "Malformed button data payload: %s", rawData);
            return;
        }
        if (btnCallback != nullptr) {
            btnCallback(index, status);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(WATER_LEVEL_UUID))) {
        int levelStatus = atoi(rawData);
        ESP_LOGV(LOG_TAG, "Level: %d", levelStatus);
        if (levelCallback != nullptr) {
            levelCallback(levelStatus);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(SENSOR_DATA_UUID))) {
        float temperature = 0.0f;
        float pressure = 0.0f;
        float puckFlow = 0.0f;
        float pumpFlow = 0.0f;
        float puckResistance = 0.0f;
        float temperature2 = 0.0f;

        int parsed =
            sscanf(rawData, "%f,%f,%f,%f,%f,%f", &temperature, &pressure, &puckFlow, &pumpFlow, &puckResistance, &temperature2);
        if (parsed < 6) {
            ESP_LOGW(LOG_TAG, "Malformed sensor data payload: %s", rawData);
            return;
        }

        ESP_LOGV(LOG_TAG,
                 "Received sensor data: temperature=%.1f, pressure=%.1f, puck_flow=%.1f, pump_flow=%.1f, puck_resistance=%.1f, "
                 "temperature2=%.1f",
                 temperature, pressure, puckFlow, pumpFlow, puckResistance, temperature2);
        if (sensorCallback != nullptr) {
            sensorCallback(temperature, pressure, puckFlow, pumpFlow, puckResistance, temperature2);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(AUTOTUNE_RESULT_UUID))) {
        ESP_LOGV(LOG_TAG, "autotune result: %s", rawData);
        if (autotuneResultCallback != nullptr) {
            float Kp = 0.0f;
            float Ki = 0.0f;
            float Kd = 0.0f;
            float Kf = 0.0f; // optional, defaults to zero
            int parsed = sscanf(rawData, "%f,%f,%f,%f", &Kp, &Ki, &Kd, &Kf);
            if (parsed < 3) {
                ESP_LOGW(LOG_TAG, "Malformed autotune payload: %s", rawData);
                return;
            }

            autotuneResultCallback(Kp, Ki, Kd, Kf);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(VOLUMETRIC_MEASUREMENT_UUID))) {
        float value = atof(rawData);
        ESP_LOGV(LOG_TAG, "Volumetric measurement: %.2f", value);
        if (volumetricMeasurementCallback != nullptr) {
            volumetricMeasurementCallback(value);
        }
    }
    if (pRemoteCharacteristic->getUUID().equals(NimBLEUUID(TOF_MEASUREMENT_UUID))) {
        int value = atoi(rawData);
        ESP_LOGV(LOG_TAG, "ToF measurement: %d", value);
        if (tofMeasurementCallback != nullptr) {
            tofMeasurementCallback(value);
        }
    }
}

void NimBLEClientController::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *controller = static_cast<NimBLEClientController *>(arg);
    while (true) {
        controller->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(5000));
    }
}
