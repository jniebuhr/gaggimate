#include "NimBLEServerController.h"

NimBLEServerController::NimBLEServerController()
    : tempControlChar(nullptr), pumpControlChar(nullptr), valveControlChar(nullptr), altControlChar(nullptr),
      tempReadChar(nullptr), pingChar(nullptr), pidControlChar(nullptr), errorChar(nullptr), autotuneChar(nullptr),
      brewBtnChar(nullptr), steamBtnChar(nullptr), infoChar(nullptr) {}

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

    // Temperature Control Characteristic (Client writes setpoint)
    tempControlChar = pService->createCharacteristic(TEMP_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    tempControlChar->setCallbacks(this); // Use this class as the callback handler

    // Pump Control Characteristic (Client writes pin state)
    pumpControlChar = pService->createCharacteristic(PUMP_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    pumpControlChar->setCallbacks(this); // Use this class as the callback handler

    // Valve Control Characteristic (Client writes pin state)
    valveControlChar = pService->createCharacteristic(VALVE_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    valveControlChar->setCallbacks(this); // Use this class as the callback handler

    // Valve Control Characteristic (Client writes pin state)
    altControlChar = pService->createCharacteristic(ALT_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    altControlChar->setCallbacks(this); // Use this class as the callback handler

    // Temperature Read Characteristic (Server notifies client of temperature)
    tempReadChar = pService->createCharacteristic(TEMP_READ_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Ping Characteristic (Client writes ping, Server reads)
    pingChar = pService->createCharacteristic(PING_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    pingChar->setCallbacks(this); // Use this class as the callback handler

    // PID control Characteristic (Client writes PID settings, Server reads)
    pidControlChar = pService->createCharacteristic(PID_CONTROL_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    pidControlChar->setCallbacks(this); // Use this class as the callback handler

    // Error Characteristic (Server writes error, Client reads)
    errorChar = pService->createCharacteristic(ERROR_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Ping Characteristic (Client writes autotune, Server reads)
    autotuneChar = pService->createCharacteristic(AUTOTUNE_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
    autotuneChar->setCallbacks(this); // Use this class as the callback handler

    // Brew button Characteristic (Server notifies client of brew button)
    brewBtnChar = pService->createCharacteristic(BREW_BTN_UUID, NIMBLE_PROPERTY::NOTIFY);

    // Steam button Characteristic (Server notifies client of steam button)
    steamBtnChar = pService->createCharacteristic(STEAM_BTN_UUID, NIMBLE_PROPERTY::NOTIFY);

    infoChar = pService->createCharacteristic(INFO_UUID, NIMBLE_PROPERTY::READ);
    setInfo(infoString);

    pService->start();

    ota_dfu_ble.configure_OTA(pServer);
    ota_dfu_ble.start_OTA();

    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    NimBLEDevice::startAdvertising();
    ESP_LOGI(LOG_TAG, "BLE Server started, advertising...\n");
}

void NimBLEServerController::sendTemperature(float temperature) {
    if (deviceConnected) {
        // Send temperature notification to the client
        char tempStr[8];
        snprintf(tempStr, sizeof(tempStr), "%.2f", temperature);
        tempReadChar->setValue(tempStr);
        tempReadChar->notify();
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

void NimBLEServerController::registerTempControlCallback(const temp_control_callback_t &callback) {
    tempControlCallback = callback;
}

void NimBLEServerController::registerPumpControlCallback(const pump_control_callback_t &callback) {
    pumpControlCallback = callback;
}

void NimBLEServerController::registerValveControlCallback(const pin_control_callback_t &callback) {
    valveControlCallback = callback;
}

void NimBLEServerController::registerAltControlCallback(const pin_control_callback_t &callback) { altControlCallback = callback; }

void NimBLEServerController::registerPingCallback(const ping_callback_t &callback) { pingCallback = callback; }

void NimBLEServerController::registerAutotuneCallback(const autotune_callback_t &callback) { autotuneCallback = callback; }

void NimBLEServerController::setInfo(const String infoString) {
    this->infoString = infoString;
    infoChar->setValue(infoString);
}

void NimBLEServerController::registerPidControlCallback(const pid_control_callback_t &callback) { pidControlCallback = callback; }

// BLEServerCallbacks override
void NimBLEServerController::onConnect(NimBLEServer *pServer) {
    ESP_LOGI(LOG_TAG, "Client connected.");
    deviceConnected = true;
    pServer->stopAdvertising();
}

void NimBLEServerController::onDisconnect(NimBLEServer *pServer) {
    ESP_LOGI(LOG_TAG, "Client disconnected.");
    deviceConnected = false;
    pServer->startAdvertising(); // Restart advertising so clients can reconnect
}

String get_token(const String &from, uint8_t index, char separator) {
    uint16_t start = 0;
    uint16_t idx = 0;
    uint8_t cur = 0;
    while (idx < from.length()) {
        if (from.charAt(idx) == separator) {
            if (cur == index) {
                return from.substring(start, idx);
            }
            cur++;
            while (idx < from.length() - 1 && from.charAt(idx + 1) == separator)
                idx++;
            start = idx + 1;
        }
        idx++;
    }
    if ((cur == index) && (start < from.length())) {
        return from.substring(start, from.length());
    }
    return "";
}

// BLECharacteristicCallbacks override
void NimBLEServerController::onWrite(NimBLECharacteristic *pCharacteristic) {
    ESP_LOGV(LOG_TAG, "Write received!");

    if (pCharacteristic->getUUID().equals(NimBLEUUID(TEMP_CONTROL_CHAR_UUID))) {
        float setpoint = atof(pCharacteristic->getValue().c_str());
        ESP_LOGV(LOG_TAG, "Received temperature setpoint: %.2f", setpoint);
        if (tempControlCallback != nullptr) {
            tempControlCallback(setpoint);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(PUMP_CONTROL_CHAR_UUID))) {
        float setpoint = atof(pCharacteristic->getValue().c_str());
        ESP_LOGV(LOG_TAG, "Received pump control: %.2f", setpoint);
        if (pumpControlCallback != nullptr) {
            pumpControlCallback(setpoint);
        }
    } else if (pCharacteristic->getUUID().equals(NimBLEUUID(VALVE_CONTROL_CHAR_UUID))) {
        bool pinState = (pCharacteristic->getValue()[0] == '1');
        ESP_LOGV(LOG_TAG, "Received valve control: %s", pinState ? "ON" : "OFF");
        if (valveControlCallback != nullptr) {
            valveControlCallback(pinState);
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
            autotuneCallback();
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
    }
}
