#include "GaggiMateController.h"
#include "utilities.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <peripherals/DimmedPump.h>
#include <peripherals/SimplePump.h>

#include <utility>
#include <cmath>

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
        [this](float Kp, float Ki, float Kd) { _comms.sendAutotuneResult(Kp, Ki, Kd); });
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
    this->brewBtn = new DigitalInput(_config.brewButtonPin, [this](const bool state) { _comms.sendBrewButton(state); });
    this->steamBtn = new DigitalInput(_config.steamButtonPin, [this](const bool state) { _comms.sendSteamButton(state); });

    // 4-Pin peripheral port
    if (!Wire.begin(_config.sunriseSdaPin, _config.sunriseSclPin, 400000)) {
        ESP_LOGE(LOG_TAG, "Failed to initialize I2C bus");
    }
    this->ledController = new LedController(&Wire);
    this->distanceSensor = new DistanceSensor(&Wire, [this](int distance) { _comms.sendTofMeasurement(distance); });
    if (this->ledController->isAvailable()) {
        _config.capabilites.ledControls = true;
        _config.capabilites.tof = true;
    }

    String systemInfo = make_system_info(_config, _version);
    _comms.init("GaggiMate");
    _comms.setDeviceInfo(systemInfo);

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
    }
    // Set up thermal feedforward for main heater if pressure/dimming capability exists
    if (heater && _config.capabilites.dimming && _config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        float *pumpFlowPtr = dimmedPump->getPumpFlowPtr();
        int *valveStatusPtr = dimmedPump->getValveStatusPtr();

        heater->setThermalFeedforward(pumpFlowPtr, 23.0f, valveStatusPtr);
        heater->setFeedforwardScale(0.0f);
    }
    // Initialize last ping time
    lastPingTime = millis();

    _comms.registerMessageCallback([this](const ProtocolMessage<std::any> &message) {
        switch (message.type) {
            case MessageType_MSG_PING:
                handlePing();
                break;
            case MessageType_MSG_OUTPUT_CONTROL: {
                handlePing();
                if (errorState != ERROR_CODE_NONE) {
                    return;
                }
                const auto payload = std::any_cast<OutputControlRequest>(message.content);
                this->valve->set(payload.valve_open);
                this->heater->setSetpoint(payload.boiler_setpoint);

                if (_config.capabilites.dimming) {
                    auto dimmedPump = static_cast<DimmedPump *>(pump);
                    if (payload.mode == 1) {
                        if (payload.pressure_target) {
                            dimmedPump->setPressureTarget(payload.pressure, payload.flow);
                        } else {
                            dimmedPump->setFlowTarget(payload.flow, payload.pressure);
                        }
                    } else {
                        this->pump->setPower(payload.pump_setpoint);
                    }
                    dimmedPump->setValveState(payload.valve_open);
                } else {
                    this->pump->setPower(payload.pump_setpoint);
                }
                break;
            }
            case MessageType_MSG_ALT_CONTROL:
                this->alt->set(std::any_cast<AltControlRequest>(message.content).pin_state);
                break;
            case MessageType_MSG_PID_SETTINGS: {
                const auto payload = std::any_cast<PidSettingsRequest>(message.content);
                this->heater->setTunings(payload.kp, payload.ki, payload.kd);
                this->heater->setFeedforwardScale(0.0f);
                break;
            }
            case MessageType_MSG_PUMP_MODEL: {
                const auto payload = std::any_cast<PumpModelCoeffsRequest>(message.content);
                if (_config.capabilites.dimming) {
                    auto dimmedPump = static_cast<DimmedPump *>(pump);
                    if (isnan(payload.c) && isnan(payload.d)) {
                        dimmedPump->setPumpFlowCoeff(payload.a, payload.b);
                    } else {
                        dimmedPump->setPumpFlowPolyCoeffs(payload.a, payload.b, payload.c, payload.d);
                    }
                }
                break;
            }
            case MessageType_MSG_AUTOTUNE: {
                const auto payload = std::any_cast<AutotuneRequest>(message.content);
                this->heater->autotune(payload.test_time, payload.samples);
                break;
            }
            case MessageType_MSG_PRESSURE_SCALE:
                if (_config.capabilites.pressure) {
                    this->pressureSensor->setScale(std::any_cast<PressureScaleRequest>(message.content).scale);
                }
                break;
            case MessageType_MSG_TARE:
                if (_config.capabilites.dimming) {
                    static_cast<DimmedPump *>(pump)->tare();
                }
                break;
            case MessageType_MSG_LED_CONTROL:
                if (_config.capabilites.ledControls) {
                    const auto payload = std::any_cast<LedControlRequest>(message.content);
                    ledController->setChannel(payload.channel, payload.brightness);
                }
                break;
            default:
                break;
        }
    });
    ESP_LOGI(LOG_TAG, "Initialization done");
}

void GaggiMateController::loop() {
    unsigned long now = millis();
    if (lastPingTime < now && (now - lastPingTime) / 1000 > PING_TIMEOUT_SECONDS) {
        handlePingTimeout();
    }
    sendSensorData();
    _comms.checkSystemInfoSend();
    delay(250);
}

void GaggiMateController::registerBoardConfig(ControllerConfig config) { configs.push_back(config); }

void GaggiMateController::detectBoard() {
    constexpr int MAX_DETECT_RETRIES = 3;
    pinMode(DETECT_EN_PIN, OUTPUT);
    pinMode(DETECT_VALUE_PIN, INPUT_PULLDOWN);

    for (int attempt = 0; attempt < MAX_DETECT_RETRIES; attempt++) {
        digitalWrite(DETECT_EN_PIN, HIGH);
        delay(10); // Allow voltage to stabilize before ADC read
        uint16_t millivolts = analogReadMilliVolts(DETECT_VALUE_PIN);
        digitalWrite(DETECT_EN_PIN, LOW);
        int boardId = round(((float)millivolts) / 100.0f - 0.5f);
        ESP_LOGI(LOG_TAG, "Board detect attempt %d/%d: ID=%d (raw: %d mV)", attempt + 1, MAX_DETECT_RETRIES, boardId, millivolts);
        for (ControllerConfig config : configs) {
            if (config.autodetectValue == boardId) {
                _config = config;
                ESP_LOGI(LOG_TAG, "Using Board: %s", _config.name.c_str());
                return;
            }
        }
        ESP_LOGW(LOG_TAG, "No match on attempt %d, retrying...", attempt + 1);
        delay(500);
    }
    ESP_LOGE(LOG_TAG, "No compatible board detected after %d attempts. Restarting...", MAX_DETECT_RETRIES);
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
    _comms.sendError(ERROR_CODE_TIMEOUT);
}

void GaggiMateController::thermalRunawayShutdown() {
    ESP_LOGE(LOG_TAG, "Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    this->heater->setSetpoint(0);
    this->pump->setPower(0);
    this->valve->set(false);
    this->alt->set(false);
    errorState = ERROR_CODE_RUNAWAY;
    _comms.sendError(ERROR_CODE_RUNAWAY);
}

void GaggiMateController::sendSensorData() {
    if (_config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        _comms.sendSensorData(this->thermocouple->read(), this->pressureSensor->getPressure(), dimmedPump->getPuckFlow(),
                            dimmedPump->getPumpFlow(), dimmedPump->getPuckResistance());
        if (this->valve->getState()) {
            _comms.sendVolumetricMeasurement(dimmedPump->getCoffeeVolume());
        }
    } else {
        _comms.sendSensorData(this->thermocouple->read(), 0.0f, 0.0f, 0.0f, 0.0f);
    }
}
