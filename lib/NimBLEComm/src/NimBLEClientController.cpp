#include "NimBLEClientController.h"
#include <cstdio>

constexpr size_t MAX_CONNECT_RETRIES = 3;

NimBLEClientController::NimBLEClientController() : client(nullptr) {}

// Create the event queue with the BLE client so callbacks can stay copy-only.
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

    if (pendingEventQueue == nullptr) {
        pendingEventQueue = xQueueCreate(PENDING_EVENT_QUEUE_LENGTH, sizeof(PendingEvent));
        if (pendingEventQueue == nullptr) {
            ESP_LOGE(LOG_TAG, "Failed to create BLE event queue");
            return;
        }
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

// Run queued notification and disconnect work outside NimBLE callback context.
void NimBLEClientController::dispatchPendingEvents() {
    if (pendingEventQueue == nullptr) {
        return;
    }

    PendingEvent event;
    for (size_t dispatched = 0; dispatched < MAX_PENDING_EVENTS_PER_DISPATCH; dispatched++) {
        if (xQueueReceive(pendingEventQueue, &event, 0) != pdTRUE) {
            break;
        }
        dispatchPendingEvent(event);
    }
}

void NimBLEClientController::sendAdvancedOutputControl(bool valve, float boilerSetpoint, bool pressureTarget, float pressure,
                                                       float flow) {
    if (client->isConnected() && outputControlChar != nullptr) {
        snprintf(advancedOutputBuffer, sizeof(advancedOutputBuffer), "1,%d,100.0,%.3f,%d,%.3f,%.3f", valve ? 1 : 0,
                 boilerSetpoint, pressureTarget ? 1 : 0, pressure, flow);
        _lastOutputControl = String(advancedOutputBuffer);
        outputControlChar->writeValue(_lastOutputControl, false);
    }
}

void NimBLEClientController::sendOutputControl(bool valve, float pumpSetpoint, float boilerSetpoint) {
    if (client->isConnected() && outputControlChar != nullptr) {
        snprintf(outputBuffer, sizeof(outputBuffer), "0,%d,%.3f,%.3f", valve ? 1 : 0, pumpSetpoint, boilerSetpoint);
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

// Queue disconnect work so earlier notifications are replayed first.
void NimBLEClientController::onDisconnect(NimBLEClient *pServer) {
    ESP_LOGI(LOG_TAG, "Disconnected from server, trying to reconnect...");

    // scan() and disconnect callbacks can re-enter BLE/display code, so defer them.
    enqueuePendingEvent(PendingEventType::Disconnect);
}

// Notification callback: copy payload bytes without invoking controller/plugin code.
void NimBLEClientController::notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length,
                                            bool) {
    enqueuePendingEvent(getPendingEventType(pRemoteCharacteristic), pData, length);
}

// Convert NimBLE callback state into queue-safe event metadata.
NimBLEClientController::PendingEventType
NimBLEClientController::getPendingEventType(NimBLERemoteCharacteristic *pRemoteCharacteristic) const {
    if (pRemoteCharacteristic == nullptr) {
        return PendingEventType::Unknown;
    }

    const NimBLEUUID uuid = pRemoteCharacteristic->getUUID();
    if (uuid.equals(NimBLEUUID(ERROR_CHAR_UUID))) {
        return PendingEventType::RemoteError;
    }
    if (uuid.equals(NimBLEUUID(BTN_UUID))) {
        return PendingEventType::Button;
    }
    if (uuid.equals(NimBLEUUID(SENSOR_DATA_UUID))) {
        return PendingEventType::SensorData;
    }
    if (uuid.equals(NimBLEUUID(AUTOTUNE_RESULT_UUID))) {
        return PendingEventType::AutotuneResult;
    }
    if (uuid.equals(NimBLEUUID(VOLUMETRIC_MEASUREMENT_UUID))) {
        return PendingEventType::VolumetricMeasurement;
    }
    if (uuid.equals(NimBLEUUID(TOF_MEASUREMENT_UUID))) {
        return PendingEventType::TofMeasurement;
    }
    return PendingEventType::Unknown;
}

// Copy callback data into the queue without blocking the NimBLE task.
bool NimBLEClientController::enqueuePendingEvent(PendingEventType type, const uint8_t *data, size_t length) {
    if (pendingEventQueue == nullptr || type == PendingEventType::Unknown) {
        return false;
    }

    PendingEvent event;
    event.type = type;
    if (data != nullptr && length > 0) {
        const size_t copyLength =
            length < (PENDING_EVENT_PAYLOAD_SIZE - 1) ? length : (PENDING_EVENT_PAYLOAD_SIZE - 1);
        memcpy(event.payload, data, copyLength);
        event.payload[copyLength] = '\0';
    }

    if (xQueueSend(pendingEventQueue, &event, 0) == pdTRUE) {
        return true;
    }

    // Prefer the newest controller state if the display loop falls behind.
    PendingEvent discarded;
    xQueueReceive(pendingEventQueue, &discarded, 0);
    if (xQueueSend(pendingEventQueue, &event, 0) == pdTRUE) {
        ESP_LOGW(LOG_TAG, "BLE event queue full, discarded oldest event");
        return true;
    }

    ESP_LOGE(LOG_TAG, "BLE event queue full, dropping event");
    return false;
}

// Replay the original notification handling from application context.
void NimBLEClientController::dispatchPendingEvent(const PendingEvent &event) {
    const char *rawData = event.payload;

    switch (event.type) {
    case PendingEventType::RemoteError: {
        int errorCode = atoi(rawData);
        ESP_LOGV(LOG_TAG, "Error read: %d", errorCode);
        if (remoteErrorCallback != nullptr) {
            remoteErrorCallback(errorCode);
        }
        break;
    }
    case PendingEventType::Button: {
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
        break;
    }
    case PendingEventType::SensorData: {
        float temperature = 0.0f;
        float pressure = 0.0f;
        float puckFlow = 0.0f;
        float pumpFlow = 0.0f;
        float puckResistance = 0.0f;

        int parsed = sscanf(rawData, "%f,%f,%f,%f,%f", &temperature, &pressure, &puckFlow, &pumpFlow, &puckResistance);
        if (parsed < 5) {
            ESP_LOGW(LOG_TAG, "Malformed sensor data payload: %s", rawData);
            return;
        }

        ESP_LOGV(LOG_TAG,
                 "Received sensor data: temperature=%.1f, pressure=%.1f, puck_flow=%.1f, pump_flow=%.1f, puck_resistance=%.1f",
                 temperature, pressure, puckFlow, pumpFlow, puckResistance);
        if (sensorCallback != nullptr) {
            sensorCallback(temperature, pressure, puckFlow, pumpFlow, puckResistance);
        }
        break;
    }
    case PendingEventType::AutotuneResult: {
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
        break;
    }
    case PendingEventType::VolumetricMeasurement: {
        float value = atof(rawData);
        ESP_LOGV(LOG_TAG, "Volumetric measurement: %.2f", value);
        if (volumetricMeasurementCallback != nullptr) {
            volumetricMeasurementCallback(value);
        }
        break;
    }
    case PendingEventType::TofMeasurement: {
        int value = atoi(rawData);
        ESP_LOGV(LOG_TAG, "ToF measurement: %d", value);
        if (tofMeasurementCallback != nullptr) {
            tofMeasurementCallback(value);
        }
        break;
    }
    case PendingEventType::Disconnect: {
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
        break;
    }
    case PendingEventType::Unknown:
        break;
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
