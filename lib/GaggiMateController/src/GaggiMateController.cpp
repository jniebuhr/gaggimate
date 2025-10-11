#include "GaggiMateController.h"
#include "utilities.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <peripherals/DimmedPump.h>
#include <peripherals/SimplePump.h>
#include <ProtocolTypes.h> // For ERROR_CODE_* constants

#include <utility>

GaggiMateController::GaggiMateController(String version) : _version(std::move(version)) {
    configs.push_back(GM_STANDARD_REV_1X);
    configs.push_back(GM_STANDARD_REV_2X);
    configs.push_back(GM_PRO_REV_1x);
    configs.push_back(GM_PRO_LEGO);
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

    // 5-Pin peripheral port
    Wire.begin(_config.sunriseSdaPin, _config.sunriseSclPin, 400000);
    this->ledController = new LedController(&Wire);
    this->distanceSensor = new DistanceSensor(&Wire, [this](int distance) { _comms.sendTofMeasurement(distance); });
    if (this->ledController->isAvailable()) {
        _config.capabilites.ledControls = true;
        _config.capabilites.tof = true;
    }

    String systemInfo = make_system_info(_config, _version);
    ESP_LOGI(LOG_TAG, "Generated system info: %s", systemInfo.c_str());
    _comms.init(String(_config.name.c_str()));  // Use device name for BLE advertising
    _comms.setDeviceInfo(systemInfo);  // Store system info for automatic sending on client connect
    ESP_LOGI(LOG_TAG, "Set device info on BLE server");

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
    if (_config.capabilites.ledControls) {
        this->ledController->setup();
    }
    if (_config.capabilites.tof) {
        this->distanceSensor->setup();
    }

    // Initialize last ping time
    lastPingTime = millis();

    // Register unified message callback
    _comms.registerMessageCallback([this](const GaggiMessage& message) {
        switch (message.which_payload) {
            case GaggiMessage_output_control_tag: {
                const auto& req = message.payload.output_control;
                this->pump->setPower(req.pump_setpoint);
                this->valve->set(req.valve_open);
                this->heater->setSetpoint(req.boiler_setpoint);
                if (!_config.capabilites.dimming) {
                    return;
                }
                auto dimmedPump = static_cast<DimmedPump *>(pump);
                dimmedPump->setValveState(req.valve_open);
                
                // Handle advanced mode
                if (req.mode == 1) { // Advanced mode
                    if (req.pressure_target) {
                        dimmedPump->setPressureTarget(req.pressure, req.flow);
                    } else {
                        dimmedPump->setFlowTarget(req.flow, req.pressure);
                    }
                }
                break;
            }
            case GaggiMessage_alt_control_tag: {
                const auto& req = message.payload.alt_control;
                this->alt->set(req.pin_state);
                break;
            }
            case GaggiMessage_pid_settings_tag: {
                const auto& req = message.payload.pid_settings;
                this->heater->setTunings(req.kp, req.ki, req.kd);
                break;
            }
            case GaggiMessage_pump_model_tag: {
                const auto& req = message.payload.pump_model;
                if (_config.capabilites.dimming) {
                    auto dimmedPump = static_cast<DimmedPump *>(pump);
                    // Check if this is a flow measurement call (a and b are flow measurements, c and d are nan)
                    if (isnan(req.c) && isnan(req.d)) {
                        dimmedPump->setPumpFlowCoeff(req.a, req.b); // a = oneBarFlow, b = nineBarFlow
                    } else {
                        dimmedPump->setPumpFlowPolyCoeffs(req.a, req.b, req.c, req.d); // a, b, c, d are polynomial coefficients
                    }
                }
                break;
            }
            case GaggiMessage_ping_tag: {
                lastPingTime = millis();
                ESP_LOGV(LOG_TAG, "Ping received, system is alive");
                break;
            }
            case GaggiMessage_autotune_tag: {
                const auto& req = message.payload.autotune;
                this->heater->autotune(req.test_time, req.samples);
                break;
            }
            case GaggiMessage_tare_tag: {
                if (!_config.capabilites.dimming) {
                    return;
                }
                auto dimmedPump = static_cast<DimmedPump *>(pump);
                dimmedPump->tare();
                break;
            }
            case GaggiMessage_pressure_scale_tag: {
                if (_config.capabilites.pressure) {
                    const auto& req = message.payload.pressure_scale;
                    this->pressureSensor->setScale(req.scale);
                }
                break;
            }
            case GaggiMessage_led_control_tag: {
                if (_config.capabilites.ledControls) {
                    const auto& req = message.payload.led_control;
                    ledController->setChannel(req.channel, req.brightness);
                }
                break;
            }
            default:
                ESP_LOGW(LOG_TAG, "Unhandled message type: %d", message.which_payload);
                break;
        }
    });
    ESP_LOGI(LOG_TAG, "Initialization done");
}

void GaggiMateController::loop() {
    unsigned long now = millis();
    if ((now - lastPingTime) / 1000 > PING_TIMEOUT_SECONDS) {
        handlePingTimeout();
    }
    
    // Check if we need to send system info to newly connected client
    _comms.checkSystemInfoSend();
    
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

void GaggiMateController::handlePingTimeout() {
    ESP_LOGE(LOG_TAG, "Ping timeout detected. Turning off heater and pump for safety.\n");
    // Turn off the heater and pump as a safety measure
    this->heater->setSetpoint(0);
    this->pump->setPower(0);
    this->valve->set(false);
    this->alt->set(false);
}

void GaggiMateController::thermalRunawayShutdown() {
    ESP_LOGE(LOG_TAG, "Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    this->heater->setSetpoint(0);
    this->pump->setPower(0);
    this->valve->set(false);
    this->alt->set(false);
    _comms.sendError(ERROR_CODE_RUNAWAY);
}

void GaggiMateController::sendSensorData() {
    // Don't send sensor data if no client is connected
    if (!_comms.isConnected()) {
        return;
    }
    
    if (_config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        _comms.sendSensorData(this->thermocouple->read(), this->pressureSensor->getPressure(), dimmedPump->getPuckFlow(),
                            dimmedPump->getPumpFlow(), dimmedPump->getPuckResistance());
        _comms.sendVolumetricMeasurement(dimmedPump->getCoffeeVolume());
    } else {
        _comms.sendSensorData(this->thermocouple->read(), 0.0f, 0.0f, 0.0f, 0.0f);
    }
}
