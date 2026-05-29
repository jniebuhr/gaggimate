#include "NimBLEServerController.h"
#include <cstdio>

NimBLEServerController::NimBLEServerController() {}

void NimBLEServerController::initServer(const String infoString) {
    this->infoString = infoString;
    NimBLEDevice::init("GPBLS");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Set to maximum power
    NimBLEDevice::setMTU(128);
    NimBLEDevice::setSecurityAuth(BLE_SM_PAIR_AUTHREQ_BOND | BLE_SM_PAIR_AUTHREQ_MITM | BLE_SM_PAIR_AUTHREQ_SC);
    NimBLEDevice::setSecurityIOCap(BLE_HS_IO_DISPLAY_YESNO);

    // Create BLE Server
    server = NimBLEDevice::createServer();
    server->setCallbacks(this); // Use this class as the callback handler

    // Create BLE Service
    NimBLEService *pService = server->createService(SERVICE_UUID);

    // Output Control Characteristic (Client writes setpoints)
    outputControlChar = pService->createCharacteristic(OUTPUT_CONTROL_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    outputControlChar->setCallbacks(this); // Use this class as the callback handler

    // Alt Control Characteristic (Client writes pin state)
    altControlChar = pService->createCharacteristic(ALT_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    altControlChar->setCallbacks(this); // Use this class as the callback handler

    // Ping Characteristic (Client writes ping, Server reads)
    pingChar = pService->createCharacteristic(PING_CHAR_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    pingChar->setCallbacks(this); // Use this class as the callback handler

    // PID control Characteristic (Client writes PID settings, Server reads)
    pidControlChar = pService->createCharacteristic(PID_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    pidControlChar->setCallbacks(this); // Use this class as the callback handler

    // Pump Model Coefficients Characteristic (Client writes pump model coefficients, Server reads)
    pumpModelCoeffsChar = pService->createCharacteristic(PUMP_MODEL_COEFFS_CHAR_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    pumpModelCoeffsChar->setCallbacks(this); // Use this class as the callback handler

    // Error Characteristic (Server writes error, Client reads)
    errorChar = pService->createCharacteristic(ERROR_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Autotune Characteristic (Client writes autotune, Server reads)
    autotuneChar = pService->createCharacteristic(AUTOTUNE_CHAR_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    autotuneChar->setCallbacks(this); // Use this class as the callback handler
    autotuneResultChar = pService->createCharacteristic(AUTOTUNE_RESULT_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Brew button Characteristic (Server notifies client of button changes)
    btnChar = pService->createCharacteristic(BTN_UUID, NIMBLE_PROPERTY::NOTIFY);

    infoChar = pService->createCharacteristic(INFO_UUID, NIMBLE_PROPERTY::READ);
    setInfo(infoString);

    // Pressure Read Characteristic (Server notifies client of pressure)
    sensorChar = pService->createCharacteristic(SENSOR_DATA_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Pressure Scale Characteristic (Client writes pressure settings, Server reads)
    pressureScaleChar = pService->createCharacteristic(PRESSURE_SCALE_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    pressureScaleChar->setCallbacks(this); // Use this class as the callback handler

    volumetricMeasurementChar = pService->createCharacteristic(VOLUMETRIC_MEASUREMENT_UUID, NIMBLE_PROPERTY::NOTIFY);
    volumetricTareChar = pService->createCharacteristic(VOLUMETRIC_TARE_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    volumetricTareChar->setCallbacks(this);

    tofMeasurementChar = pService->createCharacteristic(TOF_MEASUREMENT_UUID, NIMBLE_PROPERTY::NOTIFY);
    ledControlChar = pService->createCharacteristic(LED_CONTROL_UUID, NIMBLE_PROPERTY::WRITE_ENC | NIMBLE_PROPERTY::WRITE_AUTHEN);
    ledControlChar->setCallbacks(this);

    pService->start();

    ota_dfu_ble.configure_OTA(server);
    ota_dfu_ble.start_OTA();

    advertising = NimBLEDevice::getAdvertising();
    advertising->addServiceUUID(SERVICE_UUID);
    advertising->setScanResponse(true);
    advertising->start();
    ESP_LOGI(LOG_TAG, "BLE Server started, advertising...\n");
    xTaskCreate(loopTask, "NimBLEServerController::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void NimBLEServerController::loop() {
    // Check for PIN confirmation timeout
    checkPinConfirmationTimeout();

    if (server->getConnectedCount() == 0 && !advertising->isAdvertising()) {
        advertising->stop();
        advertising->start();
    }
}

void NimBLEServerController::sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow,
                                            float puckResistance) {
    if (deviceConnected && sensorChar != nullptr) {
        snprintf(sensorDataBuffer, sizeof(sensorDataBuffer), "%.3f,%.3f,%.3f,%.3f,%.3f", temperature, pressure, puckFlow,
                 pumpFlow, puckResistance);
        sensorChar->setValue(sensorDataBuffer);
        sensorChar->notify();
    }
}

void NimBLEServerController::sendError(int errorCode) {
    if (deviceConnected) {
        snprintf(errorBuffer, sizeof(errorBuffer), "%d", errorCode);
        errorChar->setValue(errorBuffer);
        errorChar->notify();
    }
}

void NimBLEServerController::sendBtnState(uint8_t index, bool status) {
    if (deviceConnected) {
        // Send brew notification to the client
        snprintf(btnBuffer, sizeof(btnBuffer), "%d,%d", static_cast<int>(index), static_cast<int>(status));
        btnChar->setValue(btnBuffer);
        btnChar->notify();
    }
}

void NimBLEServerController::sendAutotuneResult(float Kp, float Ki, float Kd, float Kf) {
    if (deviceConnected) {
        snprintf(autotuneResultBuffer, sizeof(autotuneResultBuffer), "%.3f,%.3f,%.3f,%.3f", Kp, Ki, Kd, Kf);
        autotuneResultChar->setValue(autotuneResultBuffer);
        autotuneResultChar->notify();
    }
}

void NimBLEServerController::sendVolumetricMeasurement(float value) {
    if (deviceConnected) {
        snprintf(volumetricBuffer, sizeof(volumetricBuffer), "%.2f", value);
        volumetricMeasurementChar->setValue(volumetricBuffer);
        volumetricMeasurementChar->notify();
    }
}

void NimBLEServerController::sendTofMeasurement(int value) {
    if (deviceConnected) {
        snprintf(tofBuffer, sizeof(tofBuffer), "%d", value);
        tofMeasurementChar->setValue(tofBuffer);
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

// Pairing mode management
bool NimBLEServerController::isPairingModeActive() const {
    if (pairingState != PairingState::PAIRING_INITIATED &&
        pairingState != PairingState::PAIRING_ACTIVE) {
        return false;
    }
    return (millis() - pairingModeStartTime) < PAIRING_TIMEOUT_MS;
}

bool NimBLEServerController::isConnectionSecure() const {
    if (!deviceConnected || server == nullptr) {
        return false;
    }

    std::vector<uint16_t> connIds = server->getPeerDevices();
    if (connIds.empty()) {
        return false;
    }

    NimBLEConnInfo connInfo = server->getPeerInfo(connIds[0]);
    return connInfo.isEncrypted() && connInfo.isBonded();
}

void NimBLEServerController::enterPairingMode() {
    ESP_LOGI(LOG_TAG, "Entering pairing mode - advertising as connectable for 60 seconds");
    pairingState = PairingState::PAIRING_INITIATED;
    pairingModeStartTime = millis();

    // Restart advertising to allow new connections
    if (deviceConnected && server != nullptr) {
        std::vector<uint16_t> connIds = server->getPeerDevices();
        if (!connIds.empty()) {
            server->disconnect(connIds[0]);
        }
    }
    if (advertising != nullptr) {
        advertising->start();
    }
}

void NimBLEServerController::exitPairingMode() {
    ESP_LOGI(LOG_TAG, "Exiting pairing mode");
    pairingState = PairingState::NORMAL;
}

void NimBLEServerController::clearAllBonds() {
    ESP_LOGW(LOG_TAG, "Clearing all bonded devices - restart required");
    NimBLEDevice::deleteAllBonds();
    // Note: Device should restart after this for clean state
}

// PIN confirmation for DISPLAY_YESNO pairing
bool NimBLEServerController::onConfirmPIN(uint32_t pass_key) {
    ESP_LOGI(LOG_TAG, "");
    ESP_LOGI(LOG_TAG, "╔════════════════════════════════════════╗");
    ESP_LOGI(LOG_TAG, "║  PAIRING CONFIRMATION REQUIRED         ║");
    ESP_LOGI(LOG_TAG, "║                                        ║");
    ESP_LOGI(LOG_TAG, "║  PIN: %06d                        ║", pass_key);
    ESP_LOGI(LOG_TAG, "║                                        ║");
    ESP_LOGI(LOG_TAG, "║  Press BREW or BOOT button to confirm ║");
    ESP_LOGI(LOG_TAG, "║  (30 second timeout)                   ║");
    ESP_LOGI(LOG_TAG, "╚════════════════════════════════════════╝");
    ESP_LOGI(LOG_TAG, "");

    currentPairingPin = pass_key;
    pinConfirmState = PinConfirmState::AWAITING_CONFIRM;
    pinConfirmStartTime = millis();

    return true; // Allow pairing to proceed (user confirmation pending)
}

void NimBLEServerController::confirmPairingPin() {
    if (pinConfirmState == PinConfirmState::AWAITING_CONFIRM) {
        ESP_LOGI(LOG_TAG, "PIN %06d confirmed by user", currentPairingPin);
        pinConfirmState = PinConfirmState::CONFIRMED;
        currentPairingPin = 0;
    }
}

void NimBLEServerController::rejectPairingPin() {
    if (pinConfirmState == PinConfirmState::AWAITING_CONFIRM) {
        ESP_LOGW(LOG_TAG, "PIN confirmation rejected (timeout or user reject)");
        pinConfirmState = PinConfirmState::REJECTED;
        currentPairingPin = 0;

        // Disconnect the pairing device
        if (server != nullptr && deviceConnected) {
            std::vector<uint16_t> connIds = server->getPeerDevices();
            if (!connIds.empty()) {
                server->disconnect(connIds[0]);
            }
        }
    }
}

bool NimBLEServerController::isPinConfirmationPending() const {
    return pinConfirmState == PinConfirmState::AWAITING_CONFIRM;
}

void NimBLEServerController::checkPinConfirmationTimeout() {
    if (pinConfirmState == PinConfirmState::AWAITING_CONFIRM) {
        unsigned long elapsed = millis() - pinConfirmStartTime;
        if (elapsed >= PIN_CONFIRM_TIMEOUT_MS) {
            ESP_LOGW(LOG_TAG, "PIN confirmation timeout after 30 seconds");
            rejectPairingPin();
        }
    }
}

// BLEServerCallbacks override
void NimBLEServerController::onConnect(NimBLEServer *pServer) {
    ESP_LOGI(LOG_TAG, "Client connected.");
    deviceConnected = true;

    // Get connection info
    std::vector<uint16_t> connIds = pServer->getPeerDevices();
    if (connIds.empty()) {
        ESP_LOGE(LOG_TAG, "No peer devices found after connection");
        return;
    }

    NimBLEConnInfo connInfo = pServer->getPeerInfo(connIds[0]);

    // Check if this is a new (unbonded) connection
    if (!connInfo.isBonded()) {
        if (isPairingModeActive()) {
            ESP_LOGI(LOG_TAG, "New device connecting in pairing mode - allowing pairing");
            pairingState = PairingState::PAIRING_ACTIVE;
            // Pairing will proceed automatically with Just Works
        } else {
            ESP_LOGW(LOG_TAG, "Unbonded device attempted connection outside pairing mode - rejecting");
            pServer->disconnect(connIds[0]);
            return;
        }
    } else {
        ESP_LOGI(LOG_TAG, "Bonded device reconnected");
        exitPairingMode(); // Exit pairing mode if active
    }

    // Stop advertising if not in pairing mode
    if (pairingState == PairingState::NORMAL) {
        pServer->stopAdvertising();
    }
}

void NimBLEServerController::onDisconnect(NimBLEServer *pServer) {
    ESP_LOGI(LOG_TAG, "Client disconnected.");
    deviceConnected = false;
    pServer->startAdvertising(); // Restart advertising so clients can reconnect
}

void NimBLEServerController::onWrite(NimBLECharacteristic *pCharacteristic) {
    // CRITICAL SECURITY CHECK: Verify connection is encrypted and bonded
    if (!isConnectionSecure()) {
        ESP_LOGE(LOG_TAG, "Rejecting write from insecure connection");
        return;
    }

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
            // Optional 3rd field — older display firmware sends only 2.
            // Wattage 0 ⇒ controller skips combinedKff derivation, autotune
            // still runs and persists Kp/Ki/Kd as before.
            int wattage = get_token(autotune, 2, ',').toInt();
            autotuneCallback(testTime, samples, wattage);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(PID_CONTROL_CHAR_UUID))) {
        auto pid = String(pCharacteristic->getValue().c_str());
        float Kp = get_token(pid, 0, ',').toFloat();
        float Ki = get_token(pid, 1, ',').toFloat();
        float Kd = get_token(pid, 2, ',').toFloat();

        // Optional thermal feedforward parameter (default value if not provided)
        float Kf = 0.0f; // Default combined feedforward gain

        String kfToken = get_token(pid, 3, ',');

        if (kfToken.length() > 0 && kfToken.toFloat() > 0.0f) {
            Kf = kfToken.toFloat();
        }

        ESP_LOGI(LOG_TAG, "BLE received PID string: '%s'", pid.c_str());
        ESP_LOGI(LOG_TAG, "Parsed PID: Kp=%.2f, Ki=%.2f, Kd=%.2f, Kf=%.3f (combined)", Kp, Ki, Kd, Kf);
        if (pidControlCallback != nullptr) {
            pidControlCallback(Kp, Ki, Kd, Kf);
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

void NimBLEServerController::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *controller = static_cast<NimBLEServerController *>(arg);
    while (true) {
        controller->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(5000));
    }
}
