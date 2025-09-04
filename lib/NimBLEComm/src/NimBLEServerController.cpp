#include "NimBLEServerController.h"

NimBLEServerController::NimBLEServerController() {}

void NimBLEServerController::initServer(const String infoString) {
    this->infoString = infoString;
    NimBLEDevice::init("GPBLS");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Set to maximum power
    NimBLEDevice::setMTU(128);

    // Create BLE Server
    NimBLEServer *pServer = NimBLEDevice::createServer();
    pServer->setCallbacks(this); // Use this class as the callback handler

    // Create BLE Service
    NimBLEService *pService = pServer->createService(SERVICE_UUID);

    // Output Control Characteristic (Client writes setpoints)
    outputControlChar = pService->createCharacteristic(OUTPUT_CONTROL_UUID, NIMBLE_PROPERTY::WRITE);
    outputControlChar->setCallbacks(this); // Use this class as the callback handler

    // Alt Control Characteristic (Client writes pin state)
    altControlChar = pService->createCharacteristic(ALT_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    altControlChar->setCallbacks(this); // Use this class as the callback handler

    // Ping Characteristic (Client writes ping, Server reads)
    pingChar = pService->createCharacteristic(PING_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    pingChar->setCallbacks(this); // Use this class as the callback handler

    // PID control Characteristic (Client writes PID settings, Server reads)
    pidControlChar = pService->createCharacteristic(PID_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    pidControlChar->setCallbacks(this); // Use this class as the callback handler

    // Pump Model Coefficients Characteristic (Client writes pump model coefficients, Server reads)
    pumpModelCoeffsChar = pService->createCharacteristic(PUMP_MODEL_COEFFS_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    pumpModelCoeffsChar->setCallbacks(this); // Use this class as the callback handler

    // Error Characteristic (Server writes error, Client reads)
    errorChar = pService->createCharacteristic(ERROR_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Ping Characteristic (Client writes autotune, Server reads)
    autotuneChar = pService->createCharacteristic(AUTOTUNE_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    autotuneChar->setCallbacks(this); // Use this class as the callback handler
    autotuneResultChar = pService->createCharacteristic(AUTOTUNE_RESULT_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Brew button Characteristic (Server notifies client of brew button)
    brewBtnChar = pService->createCharacteristic(BREW_BTN_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Steam button Characteristic (Server notifies client of steam button)
    steamBtnChar = pService->createCharacteristic(STEAM_BTN_UUID, NIMBLE_PROPERTY::NOTIFY);

    infoChar = pService->createCharacteristic(INFO_UUID, NIMBLE_PROPERTY::READ);
    setInfo(infoString);

    // Pressure Read Characteristic (Server notifies client of pressure)
    sensorChar = pService->createCharacteristic(SENSOR_DATA_UUID, NIMBLE_PROPERTY::NOTIFY);

    // PID control Characteristic (Client writes pressure settings, Server reads)
    pressureScaleChar = pService->createCharacteristic(PRESSURE_SCALE_UUID, NIMBLE_PROPERTY::WRITE);
    pressureScaleChar->setCallbacks(this); // Use this class as the callback handler

    volumetricMeasurementChar = pService->createCharacteristic(VOLUMETRIC_MEASUREMENT_UUID, NIMBLE_PROPERTY::NOTIFY);
    volumetricTareChar = pService->createCharacteristic(VOLUMETRIC_TARE_UUID, NIMBLE_PROPERTY::WRITE);
    volumetricTareChar->setCallbacks(this);

    tofMeasurementChar = pService->createCharacteristic(TOF_MEASUREMENT_UUID, NIMBLE_PROPERTY::NOTIFY);
    ledControlChar = pService->createCharacteristic(LED_CONTROL_UUID, NIMBLE_PROPERTY::WRITE);
    ledControlChar->setCallbacks(this);

    pService->start();

    ota_dfu_ble.configure_OTA(pServer);
    ota_dfu_ble.start_OTA();

    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    // setScanResponseData(true) is no longer available in NimBLE 2.x
    // The scan response data is handled automatically
    NimBLEDevice::startAdvertising();
    ESP_LOGI(LOG_TAG, "BLE Server started, advertising...\n");
}

void NimBLEServerController::sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow,
                                            float puckResistance) {
    if (deviceConnected && sensorChar != nullptr) {
        char str[30];
        snprintf(str, sizeof(str), "%.3f,%.3f,%.3f,%.3f,%.3f", temperature, pressure, puckFlow, pumpFlow, puckResistance);
        sensorChar->setValue(str);
        sensorChar->notify();
    }
}

void NimBLEServerController::sendError(int errorCode) {
    if (deviceConnected) {
        // Send temperature notification to the client
        char errorStr[8];
        snprintf(errorStr, sizeof(errorStr), "%d", errorCode);
        errorChar->setValue(errorStr);
        errorChar->notify();
    }
}

void NimBLEServerController::sendBrewBtnState(bool brewButtonStatus) {
    if (deviceConnected) {
        // Send brew notification to the client
        char brewStr[8];
        snprintf(brewStr, sizeof(brewStr), "%d", brewButtonStatus);
        brewBtnChar->setValue(brewStr);
        brewBtnChar->notify();
    }
}

void NimBLEServerController::sendSteamBtnState(bool steamButtonStatus) {
    if (deviceConnected) {
        // Send steam notification to the client
        char steamStr[8];
        snprintf(steamStr, sizeof(steamStr), "%d", steamButtonStatus);
        steamBtnChar->setValue(steamStr);
        steamBtnChar->notify();
    }
}

void NimBLEServerController::sendAutotuneResult(float Kp, float Ki, float Kd) {
    if (deviceConnected) {
        char pidStr[30];
        snprintf(pidStr, sizeof(pidStr), "%.3f,%.3f,%.3f", Kp, Ki, Kd);
        autotuneResultChar->setValue(pidStr);
        autotuneResultChar->notify();
    }
}

void NimBLEServerController::sendVolumetricMeasurement(float value) {
    if (deviceConnected) {
        char data[8];
        snprintf(data, sizeof(data), "%.2f", value);
        volumetricMeasurementChar->setValue(data);
        volumetricMeasurementChar->notify();
    }
}

void NimBLEServerController::sendTofMeasurement(int value) {
    if (deviceConnected) {
        char data[8];
        snprintf(data, sizeof(data), "%d", value);
        tofMeasurementChar->setValue(data);
        tofMeasurementChar->notify();
    }
}

void NimBLEServerController::registerOutputControlCallback(const simple_output_callback_t &callback) {
    outputControlCallback = callback;
}

void NimBLEServerController::registerAdvancedOutputControlCallback(const advanced_output_callback_t &callback) {
    advancedControlCallback = callback;
}

void NimBLEServerController::registerAltControlCallback(const pin_control_callback_t &callback) { altControlCallback = callback; }
void NimBLEServerController::registerPingCallback(const ping_callback_t &callback) { pingCallback = callback; }
void NimBLEServerController::registerAutotuneCallback(const autotune_callback_t &callback) { autotuneCallback = callback; }
void NimBLEServerController::registerPressureScaleCallback(const float_callback_t &callback) { pressureScaleCallback = callback; }

void NimBLEServerController::registerTareCallback(const void_callback_t &callback) { tareCallback = callback; }

void NimBLEServerController::registerLedControlCallback(const led_control_callback_t &callback) { ledControlCallback = callback; }

void NimBLEServerController::setInfo(const String infoString) {
    this->infoString = infoString;
    infoChar->setValue(infoString);
}

void NimBLEServerController::registerPidControlCallback(const pid_control_callback_t &callback) { pidControlCallback = callback; }

void NimBLEServerController::registerPumpModelCoeffsCallback(const pump_model_coeffs_callback_t &callback) {
    pumpModelCoeffsCallback = callback;
}

// BLEServerCallbacks override
void NimBLEServerController::onConnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo) {
    ESP_LOGI(LOG_TAG, "Client connected.");
    deviceConnected = true;
    pServer->stopAdvertising();
}

void NimBLEServerController::onDisconnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo, int reason) {
    ESP_LOGI(LOG_TAG, "Client disconnected.");
    deviceConnected = false;
    pServer->startAdvertising(); // Restart advertising so clients can reconnect
}

void NimBLEServerController::onWrite(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo &connInfo) {
    ESP_LOGV(LOG_TAG, "Write received!");

    if (pCharacteristic->getUUID().equals(NimBLEUUID(OUTPUT_CONTROL_UUID))) {
        auto control = String(pCharacteristic->getValue().c_str());
        uint8_t type = get_token(control, 0, ',').toInt();
        uint8_t valve = get_token(control, 1, ',').toInt();
        float boilerSetpoint = get_token(control, 3, ',').toFloat();
        if (type == 0) {
            float pumpSetpoint = get_token(control, 2, ',').toFloat();
            ESP_LOGV(LOG_TAG, "Received output control: type=%d, valve=%d, pump=%.1f, boiler=%.1f", type, valve, pumpSetpoint,
                     boilerSetpoint);
            if (outputControlCallback != nullptr) {
                outputControlCallback(valve == 1, pumpSetpoint, boilerSetpoint);
            }
        } else if (type == 1) {
            bool pressureTarget = get_token(control, 4, ',').toInt() == 1;
            float pumpPressure = get_token(control, 5, ',').toFloat();
            float pumpFlow = get_token(control, 6, ',').toFloat();
            ESP_LOGV(LOG_TAG, "Received advanced output control: type=%d, valve=%d, pressure_target=%d, pressure=%.1f, flow=%.1f",
                     type, valve, pressureTarget, pumpPressure, pumpFlow);
            if (advancedControlCallback != nullptr) {
                advancedControlCallback(valve == 1, boilerSetpoint, pressureTarget, pumpPressure, pumpFlow);
            }
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(ALT_CONTROL_CHAR_UUID))) {
        bool pinState = (pCharacteristic->getValue()[0] == '1');
        ESP_LOGV(LOG_TAG, "Received ALT control: %s", pinState ? "ON" : "OFF");
        if (altControlCallback != nullptr) {
            altControlCallback(pinState);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(PING_CHAR_UUID))) {
        ESP_LOGV(LOG_TAG, "Received ping");
        if (pingCallback != nullptr) {
            pingCallback();
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(AUTOTUNE_CHAR_UUID))) {
        ESP_LOGV(LOG_TAG, "Received autotune");
        if (autotuneCallback != nullptr) {
            auto autotune = String(pCharacteristic->getValue().c_str());
            int testTime = get_token(autotune, 0, ',').toInt();
            int samples = get_token(autotune, 1, ',').toInt();
            autotuneCallback(testTime, samples);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(PID_CONTROL_CHAR_UUID))) {
        auto pid = String(pCharacteristic->getValue().c_str());
        float Kp = get_token(pid, 0, ',').toFloat();
        float Ki = get_token(pid, 1, ',').toFloat();
        float Kd = get_token(pid, 2, ',').toFloat();
        ESP_LOGV(LOG_TAG, "Received PID settings: %.2f, %.2f, %.2f", Kp, Ki, Kd);
        if (pidControlCallback != nullptr) {
            pidControlCallback(Kp, Ki, Kd);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(PUMP_MODEL_COEFFS_CHAR_UUID))) {
        auto pumpModelCoeffs = String(pCharacteristic->getValue().c_str());
        float a = get_token(pumpModelCoeffs, 0, ',').toFloat();
        float b = get_token(pumpModelCoeffs, 1, ',').toFloat();
        float c = get_token(pumpModelCoeffs, 2, ',', "nan").toFloat();
        float d = get_token(pumpModelCoeffs, 3, ',', "nan").toFloat();
        ESP_LOGV(LOG_TAG, "Received pump flow polynomial coefficients: %.6f, %.6f, %.6f, %.6f", a, b, c, d);
        if (pumpModelCoeffsCallback != nullptr) {
            pumpModelCoeffsCallback(a, b, c, d);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(PRESSURE_SCALE_UUID))) {
        String scale_string = pCharacteristic->getValue().c_str();
        float scale_value = scale_string.toFloat();

        ESP_LOGV(LOG_TAG, "Received pressure scale: %.2f", scale_value);
        if (pressureScaleCallback != nullptr) {
            pressureScaleCallback(scale_value);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(VOLUMETRIC_TARE_UUID))) {
        ESP_LOGV(LOG_TAG, "Received tare");
        if (tareCallback != nullptr) {
            tareCallback();
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(LED_CONTROL_UUID))) {
        if (ledControlCallback != nullptr) {
            auto msg = String(pCharacteristic->getValue().c_str());
            uint8_t channel = get_token(msg, 0, ',').toInt();
            uint8_t brightness = get_token(msg, 1, ',').toInt();
            ledControlCallback(channel, brightness);
            ESP_LOGV(LOG_TAG, "Received led control, %d: %d", channel, brightness);
        }
    }
}
