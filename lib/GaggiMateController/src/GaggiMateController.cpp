#include "GaggiMateController.h"
#include "utilities.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <peripherals/DimmedPump.h>
#include <peripherals/SimplePump.h>

#include <utility>

GaggiMateController::GaggiMateController(String version) : _version(std::move(version)) {
    configs.push_back(GM_STANDARD_REV_1X);
    configs.push_back(GM_STANDARD_REV_2X);
    configs.push_back(GM_PRO_REV_1x);
    configs.push_back(GM_PRO_LEGO);
    configs.push_back(GM_PRO_REV_11);
}

void GaggiMateController::setup() {
    delay(5000);
    detectBoard();
    detectAddon();

    this->thermocouple = new Max31855Thermocouple(
        _config.maxCsPin, _config.maxMisoPin, _config.maxSckPin, [this](float temperature) { /* noop */ },
        [this]() { thermalRunawayShutdown(); });
    this->heater = new Heater(
        this->thermocouple, _config.heaterPin, [this]() { thermalRunawayShutdown(); },
        [this](float Kp, float Ki, float Kd) { _ble.sendAutotuneResult(Kp, Ki, Kd); });
    this->valve = new SimpleRelay(_config.valvePin, _config.valveOn);
    this->alt = new SimpleRelay(_config.altPin, _config.altOn);
    if (_config.capabilites.pressure) {
        pressureSensor = new PressureSensor(_config.pressureSda, _config.pressureScl, [this](float pressure) { /* noop */ });
    }
    if (_config.capabilites.dimming) {
        pump = new DimmedPump(_config.pumpPin, _config.pumpSensePin, pressureSensor);
    } else {
        pump = new SimplePump(_config.pumpPin, _config.pumpOn, _config.capabilites.ssrPump ? 1000.0f : 5000.0f);
    }
    this->brewBtn = new DigitalInput(_config.brewButtonPin, [this](const bool state) { _ble.sendBrewBtnState(state); });
    this->steamBtn = new DigitalInput(_config.steamButtonPin, [this](const bool state) { _ble.sendSteamBtnState(state); });

    // 4-Pin peripheral port
    if (!Wire.begin(_config.sunriseSdaPin, _config.sunriseSclPin, 400000)) {
        ESP_LOGE(LOG_TAG, "Failed to initialize I2C bus");
    }
    this->ledController = new LedController(&Wire);
    this->distanceSensor = new DistanceSensor(&Wire, [this](int distance) { _ble.sendTofMeasurement(distance); });
    if (this->ledController->isAvailable()) {
        _config.capabilites.ledControls = true;
        _config.capabilites.tof = true;
        _ble.registerLedControlCallback(
            [this](uint8_t channel, uint8_t brightness) { ledController->setChannel(channel, brightness); });
    }

    String systemInfo = make_system_info(_config, _version);
    _ble.initServer(systemInfo);

    if (_config.capabilites.ledControls) {
        this->ledController->setup();
    }
    if (_config.capabilites.tof) {
        this->distanceSensor->setup();
    }

    this->thermocouple->setup();
    this->heater->setup();
    this->valve->setup();
    this->alt->setup();
    this->pump->setup();
    this->brewBtn->setup();
    this->steamBtn->setup();
    if (_config.capabilites.pressure) {
        pressureSensor->setup();
        _ble.registerPressureScaleCallback([this](float scale) { this->pressureSensor->setScale(scale); });
    }
   // Set up thermal feedforward for main heater if pressure/dimming capability exists
    if (heater && _config.capabilites.dimming && _config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        float* pumpFlowPtr = dimmedPump->getPumpFlowPtr();
        int* valveStatusPtr = dimmedPump->getValveStatusPtr();
        
        heater->setThermalFeedforward(pumpFlowPtr, 23.0f, valveStatusPtr);
        heater->setFeedforwardScale(0.0f);
        

    } 
    // Initialize last ping time
    lastPingTime = millis();

    _ble.registerOutputControlCallback([this](bool valve, float pumpSetpoint, float heaterSetpoint) {
        handlePing();
        if (errorState != ERROR_CODE_NONE) {
            return;
        }
        this->pump->setPower(pumpSetpoint);
        this->valve->set(valve);
        this->heater->setSetpoint(heaterSetpoint);
        if (!_config.capabilites.dimming) {
            return;
        }
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        dimmedPump->setValveState(valve);
    });
    _ble.registerAdvancedOutputControlCallback(
        [this](bool valve, float heaterSetpoint, bool pressureTarget, float pressure, float flow) {
            handlePing();
            if (errorState != ERROR_CODE_NONE) {
                return;
            }
            this->valve->set(valve);
            this->heater->setSetpoint(heaterSetpoint);
            if (!_config.capabilites.dimming) {
                return;
            }
            auto dimmedPump = static_cast<DimmedPump *>(pump);
            if (pressureTarget) {
                dimmedPump->setPressureTarget(pressure, flow);
            } else {
                dimmedPump->setFlowTarget(flow, pressure);
            }
            dimmedPump->setValveState(valve);
        });
    _ble.registerAltControlCallback([this](bool state) { this->alt->set(state); });
    _ble.registerPidControlCallback([this](float Kp, float Ki, float Kd, float Kf) { 
        this->heater->setTunings(Kp, Ki, Kd); 
        
        // Apply thermal feedforward parameters if available
        this->heater->setFeedforwardScale(Kf);

    });
    _ble.registerPumpModelCoeffsCallback([this](float a, float b, float c, float d) {
        if (_config.capabilites.dimming) {
            auto dimmedPump = static_cast<DimmedPump *>(pump);
            // Check if this is a flow measurement call (a and b are flow measurements, c and d are nan)
            if (isnan(c) && isnan(d)) {
                dimmedPump->setPumpFlowCoeff(a, b); // a = oneBarFlow, b = nineBarFlow
            } else {
                dimmedPump->setPumpFlowPolyCoeffs(a, b, c, d); // a, b, c, d are polynomial coefficients
            }
        }
    });
    _ble.registerPingCallback([this]() { handlePing(); });
    _ble.registerAutotuneCallback([this](int goal, int windowSize) { this->heater->autotune(goal, windowSize); });
    _ble.registerTareCallback([this]() {
        if (!_config.capabilites.dimming) {
            return;
        }
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        dimmedPump->tare();
    });
    ESP_LOGI(LOG_TAG, "Initialization done");
}

void GaggiMateController::loop() {
    unsigned long now = millis();
    if (lastPingTime < now && (now - lastPingTime) / 1000 > PING_TIMEOUT_SECONDS) {
        handlePingTimeout();
    }
    sendSensorData();
    delay(250);
}

void GaggiMateController::registerBoardConfig(ControllerConfig config) { configs.push_back(config); }

void GaggiMateController::detectBoard() {
    pinMode(DETECT_EN_PIN, OUTPUT);
    pinMode(DETECT_VALUE_PIN, INPUT_PULLDOWN);
    digitalWrite(DETECT_EN_PIN, HIGH);
    uint16_t millivolts = analogReadMilliVolts(DETECT_VALUE_PIN);
    digitalWrite(DETECT_EN_PIN, LOW);
    int boardId = round(((float)millivolts) / 100.0f - 0.5f);
    ESP_LOGI(LOG_TAG, "Detected Board ID: %d", boardId);
    for (ControllerConfig config : configs) {
        if (config.autodetectValue == boardId) {
            _config = config;
            ESP_LOGI(LOG_TAG, "Using Board: %s", _config.name.c_str());
            return;
        }
    }
    ESP_LOGW(LOG_TAG, "No compatible board detected.");
    delay(5000);
    ESP.restart();
}

void GaggiMateController::detectAddon() {
    // TODO: Add I2C scanning for extensions
}

void GaggiMateController::handlePing() {
    if (errorState == ERROR_CODE_TIMEOUT) {
        errorState = ERROR_CODE_NONE;
    }
    lastPingTime = millis();
    ESP_LOGV(LOG_TAG, "Ping received, system is alive");
}

void GaggiMateController::handlePingTimeout() {
    ESP_LOGE(LOG_TAG, "Ping timeout detected. Turning off heater and pump for safety.\n");
    // Turn off the heater and pump as a safety measure
    this->heater->setSetpoint(0);
    this->pump->setPower(0);
    this->valve->set(false);
    this->alt->set(false);
    errorState = ERROR_CODE_TIMEOUT;
}

void GaggiMateController::thermalRunawayShutdown() {
    ESP_LOGE(LOG_TAG, "Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    this->heater->setSetpoint(0);
    this->pump->setPower(0);
    this->valve->set(false);
    this->alt->set(false);
    errorState = ERROR_CODE_RUNAWAY;
    _ble.sendError(ERROR_CODE_RUNAWAY);
}

void GaggiMateController::sendSensorData() {
    if (_config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        _ble.sendSensorData(this->thermocouple->read(), this->pressureSensor->getPressure(), dimmedPump->getPuckFlow(),
                            dimmedPump->getPumpFlow(), dimmedPump->getPuckResistance());
        _ble.sendVolumetricMeasurement(dimmedPump->getCoffeeVolume());
    } else {
        _ble.sendSensorData(this->thermocouple->read(), 0.0f, 0.0f, 0.0f, 0.0f);
    }
}
