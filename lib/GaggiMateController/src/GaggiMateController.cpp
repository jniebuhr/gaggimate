#include "GaggiMateController.h"
#include "utilities.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <peripherals/DimmedPump.h>
#include <peripherals/SimplePump.h>

#include <peripherals/NtcThermistor.h>
#include <utility>

GaggiMateController::GaggiMateController(String version) : _version(std::move(version)) {
    configs.push_back(GM_STANDARD_REV_1X);
    configs.push_back(GM_STANDARD_REV_2X);
    configs.push_back(GM_STANDARD_REV_3X);
    configs.push_back(GM_PRO_REV_1x);
    configs.push_back(GM_PRO_LEGO);
    configs.push_back(GM_PRO_REV_11);
    configs.push_back(GM_MAX_REV10);
}

void GaggiMateController::setup() {
    delay(5000);
    detectBoard();
    detectAddon();

    if (!_config.capabilites.dualBoiler) {
        brewTemperature = new Max31855Thermocouple(
            _config.maxCsPin, _config.maxMisoPin, _config.maxSckPin, [this](float temperature) { /* noop */ },
            [this]() { thermalRunawayShutdown(); });
    }
    if (_config.capabilites.pressure || _config.capabilites.dualBoiler) {
        adc = new ADSAdc(_config.pressureSda, _config.pressureScl, 4);
        pressureSensor = new PressureSensor(this->adc);
        if (_config.capabilites.dualBoiler) {
            this->brewTemperature =
                new NtcThermistor(this->adc, 2, [this]() { thermalRunawayShutdown(); }, 50000.0f, 10000.0f, 4.096f, 3988.0f);
            this->steamTemperature =
                new NtcThermistor(this->adc, 3, [this]() { thermalRunawayShutdown(); }, 50000.0f, 10000.0f, 4.096f, 3988.0f);
        }
    }
    heater = new Heater(
        this->brewTemperature, _config.heaterPin, [this]() { thermalRunawayShutdown(); },
        [this](float Kp, float Ki, float Kd) { _ble.sendAutotuneResult(Kp, Ki, Kd); });
    if (_config.capabilites.dualBoiler) {
        heater2 = new Heater(
            this->steamTemperature, _config.altPin, [this]() { thermalRunawayShutdown(); },
            [this](float Kp, float Ki, float Kd) { _ble.sendAutotuneResult(Kp, Ki, Kd); });
        refill = new SimpleRelay(_config.refillPin, _config.valveOn);
        aux = new SimpleRelay(_config.auxPin, _config.valveOn);
        waterSense = new DigitalInput(_config.waterSensePin, [this](const bool state) { _ble.sendLevelState(state); }, 25);
        lights = new SimpleRelay(_config.ledPin, HIGH);
    } else {
        alt = new SimpleRelay(_config.altPin, _config.altOn);
    }
    valve = new SimpleRelay(_config.valvePin, _config.valveOn);
    if (_config.capabilites.dimming) {
        pump = new DimmedPump(_config.pumpPin, _config.pumpSensePin, pressureSensor);
    } else {
        pump = new SimplePump(_config.pumpPin, _config.pumpOn, _config.capabilites.ssrPump ? 1000.0f : 5000.0f);
    }
    brewBtn = new DigitalInput(_config.brewButtonPin, [this](const bool state) { _ble.sendBtnState(0, state); });
    steamBtn = new DigitalInput(_config.steamButtonPin, [this](const bool state) { _ble.sendBtnState(1, state); });
    if (_config.waterButtonPin != 0) {
        waterBtn = new DigitalInput(_config.waterButtonPin, [this](const bool state) { _ble.sendBtnState(2, state); });
    }

    // 4-Pin peripheral port
    if (!Wire.begin(_config.sunriseSdaPin, _config.sunriseSclPin, 400000)) {
        ESP_LOGE(LOG_TAG, "Failed to initialize I2C bus");
    }
    ledController = new LedController(&Wire);
    distanceSensor = new DistanceSensor(&Wire, [this](int distance) { _ble.sendTofMeasurement(distance); });
    if (ledController->isAvailable()) {
        _config.capabilites.ledControls = true;
        _config.capabilites.tof = true;
        _ble.registerLedControlCallback(
            [this](uint8_t channel, uint8_t brightness) { ledController->setChannel(channel, brightness); });
    }

    String systemInfo = make_system_info(_config, _version);
    _ble.initServer(systemInfo);

    if (_config.capabilites.ledControls) {
        ledController->setup();
    }
    if (_config.capabilites.tof) {
        distanceSensor->setup();
    }

    if (_config.capabilites.pressure || _config.capabilites.dualBoiler) {
        adc->setup();
        pressureSensor->setup();
        _ble.registerPressureScaleCallback([this](float scale) { this->pressureSensor->setScale(scale); });
    }
    brewTemperature->setup();
    heater->setup();
    valve->setup();
    pump->setup();
    brewBtn->setup();
    steamBtn->setup();
    if (waterBtn != nullptr) {
        waterBtn->setup();
    }
    if (_config.capabilites.dualBoiler) {
        steamTemperature->setup();
        heater2->setup();
        refill->setup();
        aux->setup();
        waterSense->setup();
        lights->setup();
    } else {
        alt->setup();
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

    _ble.registerOutputControlCallback(
        [this](bool valve, float pumpSetpoint, float heaterSetpoint, bool refill, float heater2Setpoint) {
            handlePing();
            if (errorState != ERROR_CODE_NONE) {
                return;
            }
            pump->setPower(pumpSetpoint);
            this->valve->set(valve);
            heater->setSetpoint(heaterSetpoint);
            if (_config.capabilites.dualBoiler) {
                this->refill->set(refill);
                this->heater2->setSetpoint(heater2Setpoint);
                this->lights->set(heaterSetpoint != 0.0f);
            }
            if (!_config.capabilites.dimming) {
                return;
            }
            auto dimmedPump = static_cast<DimmedPump *>(pump);
            dimmedPump->setValveState(valve);
        });
    _ble.registerAdvancedOutputControlCallback([this](bool valve, float heaterSetpoint, bool pressureTarget, float pressure,
                                                      float flow, bool refill, float heater2Setpoint) {
        handlePing();
        if (errorState != ERROR_CODE_NONE) {
            return;
        }
        this->valve->set(valve);
        this->heater->setSetpoint(heaterSetpoint);
        if (_config.capabilites.dualBoiler) {
            this->refill->set(refill);
            this->heater2->setSetpoint(heater2Setpoint);
            this->lights->set(heaterSetpoint != 0.0f);
        }
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
    if (!_config.capabilites.dualBoiler) {
        _ble.registerAltControlCallback([this](bool state) { this->alt->set(state); });
    }
    _ble.registerPidControlCallback([this](float Kp, float Ki, float Kd, float Kf) {
        heater->setTunings(Kp, Ki, Kd);

        // Apply thermal feedforward parameters if available
        heater->setFeedforwardScale(Kf);

        if (heater2 != nullptr) {
            this->heater2->setTunings(Kp, Ki, Kd);
        }
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
    if (Serial.available()) {
        while (Serial.available()) {
            char c = Serial.read();
            handleSerialCommand(c);
        }
    }
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
    if (_config.capabilites.dualBoiler) {
        this->heater2->setSetpoint(0);
        this->refill->set(false);
        this->aux->set(false);
    } else {
        this->alt->set(false);
    }
    errorState = ERROR_CODE_TIMEOUT;
}

void GaggiMateController::thermalRunawayShutdown() {
    ESP_LOGE(LOG_TAG, "Thermal runaway detected! Turning off heater and pump!\n");
    // Turn off the heater and pump immediately
    this->heater->setSetpoint(0);
    this->pump->setPower(0);
    this->valve->set(false);
    if (_config.capabilites.dualBoiler) {
        this->heater2->setSetpoint(0);
        this->refill->set(false);
        this->aux->set(false);
    } else {
        this->alt->set(false);
    }
    errorState = ERROR_CODE_RUNAWAY;
    _ble.sendError(ERROR_CODE_RUNAWAY);
}

void GaggiMateController::sendSensorData() {
    float temp = this->brewTemperature->read();
    float temp2 = 0.0f;
    if (_config.capabilites.dualBoiler) {
        temp2 = this->steamTemperature->read();
    }
    if (_config.capabilites.pressure) {
        auto dimmedPump = static_cast<DimmedPump *>(pump);
        _ble.sendSensorData(this->brewTemperature->read(), this->pressureSensor->getPressure(), dimmedPump->getPuckFlow(),
                            dimmedPump->getPumpFlow(), dimmedPump->getPuckResistance(), temp2);
        if (this->valve->getState()) {
            _ble.sendVolumetricMeasurement(dimmedPump->getCoffeeVolume());
        }
    } else {
        _ble.sendSensorData(temp, 0.0f, 0.0f, 0.0f, 0.0f, temp2);
    }
}

void GaggiMateController::handleSerialCommand(char c) {
    if (c == 'S') {
        ESP_LOGI("Controller", "");
        ESP_LOGI("Controller", "╔════════════════╗");
        ESP_LOGI("Controller", "║ Status Summary ║");
        ESP_LOGI("Controller", "╠════════════════╝");
        ESP_LOGI("Controller", "║");
        ESP_LOGI("Controller", "╠═ Error codes");
        ESP_LOGI("Controller", "║  ├─ Controller Error: %d", errorState);
        ESP_LOGI("Controller", "║  └─ Thermocouple Error: %d", brewTemperature->isErrorState());
        ESP_LOGI("Controller", "║");
        ESP_LOGI("Controller", "╠═ Readings");
        if (_config.capabilites.pressure) {
            auto dimmedPump = static_cast<DimmedPump *>(pump);
            ESP_LOGI("Controller", "║  ├─ Pressure: %.2f", pressureSensor->getPressure());
            ESP_LOGI("Controller", "║  ├─ Flow: %.2f", dimmedPump->getPumpFlow());
            ESP_LOGI("Controller", "║  ├─ Pump Power: %.2f", dimmedPump->getPowerTarget());
        }
        if (_config.capabilites.dualBoiler) {
            ESP_LOGI("Controller", "║  ├─ Steam Boiler Low: %.2f", waterSense->getState());
            ESP_LOGI("Controller", "║  ├─ Temperature2: %.2f", steamTemperature->read());
        }
        ESP_LOGI("Controller", "║  └─ Temperature: %.2f", brewTemperature->read());
        ESP_LOGI("Controller", "║");
        ESP_LOGI("Controller", "╠═ Control");
        if (_config.capabilites.dualBoiler) {
            ESP_LOGI("Controller", "║  ├─ Refill: %d", refill->getState());
            ESP_LOGI("Controller", "║  ├─ Aux: %d", aux->getState());
            ESP_LOGI("Controller", "║  ├─ Steam Temperature: %d", heater2->getSetpoint());
        }
        if (_config.capabilites.pressure) {
            auto dimmedPump = static_cast<DimmedPump *>(pump);
            ESP_LOGI("Controller", "║  ├─ Pressure: %.2f", dimmedPump->getPressureTarget());
            ESP_LOGI("Controller", "║  ├─ Flow: %.2f", dimmedPump->getFlowTarget());
            ESP_LOGI("Controller", "║  ├─ Pump Power: %.2f", dimmedPump->getPowerTarget());
            ESP_LOGI("Controller", "║  ├─ Pump Power: %.2f", dimmedPump->getPowerTarget());
        }
        ESP_LOGI("Controller", "║  └─ Temperature: %.2f", heater->getSetpoint());
        ESP_LOGI("Controller", "║");

        size_t free = heap_caps_get_free_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
        size_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
        size_t total = heap_caps_get_total_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
        float fragmentation = 100 - (largest * 100) / free;
        ESP_LOGI("Controller", "╠═ Memory");
        ESP_LOGI("Controller", "║  ├─ Heap: %d / %d (%.2f%%)", (total - free), total, (100.0f * (total - free)) / total);
        ESP_LOGI("Controller", "║  └─ Fragmentation: %.2f%%", fragmentation);
        ESP_LOGI("Controller", "");
    } else {
        ESP_LOGI("Controller", "Unrecognized Input! Available commands: S (Status)");
    }
}
