#include "DimmedPump.h"

#include <GaggiMateController.h>

DimmedPump::DimmedPump(uint8_t ssr_pin, uint8_t sense_pin, PressureSensor *pressure_sensor)
    : _ssr_pin(ssr_pin), _sense_pin(sense_pin), _psm(_sense_pin, _ssr_pin, 100, FALLING, 1, 4), _pressureSensor(pressure_sensor) {
    _psm.set(0);
    _pressureGains.push_back(0.002f);
    _pressureGains.push_back(0.005f);
    _pressureGains.push_back(0.01f);
    _pressureGains.push_back(0.02f);
    _pressureGains.push_back(0.03f);
    _pressureGains.push_back(0.15f);
    _pressureGains.push_back(0.20f);
    _pressureGains.push_back(0.15f);
    _pressureGains.push_back(0.1f);
    _pressureGains.push_back(0.09f);
    _pressureGains.push_back(0.085f);
    _pressureGains.push_back(0.08f);
    _pressureGains.push_back(0.07f);
}

void DimmedPump::setup() {
    _cps = _psm.cps();
    if (_cps > 70) {
        _psm.setDivider(2);
        _cps = _psm.cps();
    }
    xTaskCreate(loopTask, "DimmedPump::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DimmedPump::loop() {
    _currentPressure = _pressureSensor->getPressure();
    updatePower();
}

void DimmedPump::calibrate() {
    _pressureGains.clear();
    _opvPressure = 0;
    float lastPressure = 0;
    float lastRoundedPressure = 0;
    _currentPressure = _pressureSensor->getPressure();
    _psm.set(10);
    vTaskDelay(100);
    do {
        vTaskDelay(100);
        lastRoundedPressure = round(_currentPressure - 0.5);
        lastPressure = _currentPressure;
        _currentPressure = _pressureSensor->getPressure();
        if (round(_currentPressure - 0.5) > lastRoundedPressure) {
            float gain = (_currentPressure - lastPressure) * 10.0f / (static_cast<float>(_cps) / 10.0f);
            ESP_LOGI("DimmedPump", "Gain: %.6f at %.6f bar", gain, round(_currentPressure - 0.5));
            _pressureGains.push_back(gain);
        }
    } while (_currentPressure > lastPressure - 0.1 || _currentPressure < 4.0f);
    _opvPressure = _currentPressure;

    ESP_LOGI("DimmedPump", "Finished calibration");
    ESP_LOGI("DimmedPump", "Power line frequency: %d", _cps);
    ESP_LOGI("DimmedPump", "OPV Pressure: %.2f", _opvPressure);
    ESP_LOGI("DimmedPump", "Gains:");
    for (auto gain : _pressureGains) {
        ESP_LOGI("DimmedPump", "  %.6f", gain);
    }
    _psm.set(0);
}

void DimmedPump::setPower(float setpoint) {
    ESP_LOGV(LOG_TAG, "Setting power to %2f", setpoint);
    _mode = ControlMode::POWER;
    _power = std::clamp(setpoint, 0.0f, 100.0f);
    _psm.set(static_cast<int>(_power));
}

void DimmedPump::loopTask(void *arg) {
    auto *pump = static_cast<DimmedPump *>(arg);
    while (true) {
        pump->loop();
        vTaskDelay(50 / portTICK_PERIOD_MS);
    }
}

void DimmedPump::updatePower() {
    float newPower = _power;

    switch (_mode) {
    case ControlMode::PRESSURE:
        newPower = calculatePowerForPressure(_targetPressure, _currentPressure, _flowLimit);
        ESP_LOGI("DimmedPump", "Calculating power for pressure: %.2f", newPower);
        break;

    case ControlMode::FLOW:
        newPower = calculatePowerForFlow(_targetFlow, _currentPressure, _pressureLimit);
        break;

    case ControlMode::POWER:
        _psm.set(static_cast<int>(_power));
        break;
    }

    if (newPower != _power && _mode != ControlMode::POWER) {
        newPower = std::clamp(newPower, 0.0f, 100.0f);
        _power = 0.8f * _power + 0.2f * newPower;
        _psm.set(static_cast<int>(_power));
    }
}

float DimmedPump::calculateFlowRate(float pressure) const {
    float flow = BASE_FLOW_RATE;
    float pressurePercentage = pressure / MAX_PRESSURE;
    return flow * pressurePercentage;
}

float DimmedPump::calculatePowerForPressure(float targetPressure, float currentPressure, float flowLimit) {
    float error = targetPressure - currentPressure;
    float baseResponse = 0.0f;
    float pressureGain = _currentPressure - _lastPressure;
    float pressureLoss = _expectedPressureGain - pressureGain;
    float pressureLevel = std::clamp(round(_currentPressure), 0.0f, static_cast<float>(_pressureGains.size()));
    float pressureGainPerTick = _pressureGains[pressureLevel];
    float maxPressureGain = pressureGainPerTick * static_cast<float>(_cps) / 20.0f;
    ESP_LOGI("DimmedPump", "Pressure: %.2f, Gain: %.6f, Expected Gain: %.6f, Pressure Loss: %.6f, Error: %.6f, Per Tick: %.6f",
             currentPressure, pressureGain, _expectedPressureGain, pressureLoss, error, pressureGainPerTick);
    if (error + pressureLoss > maxPressureGain) {
        baseResponse = 100.0f;
    } else if (error + pressureLoss > 0.0f) {
        float desiredGain = std::clamp(error + pressureLoss, 0.0f, maxPressureGain);
        float gainRatio = desiredGain / maxPressureGain;
        baseResponse = gainRatio * 100.0f;
    }
    _lastPressure = currentPressure;
    _expectedPressureGain = baseResponse * static_cast<float>(_cps) / 100.0f / 20.0f * pressureGainPerTick;

    if (flowLimit > 0.0f) {
        float maxFlowPower = calculatePowerForFlow(flowLimit, currentPressure, 100.0f);
        return std::min(baseResponse, maxFlowPower);
    }

    ESP_LOGI("DimmedPump", "Return: %f", baseResponse);
    return baseResponse;
}

float DimmedPump::calculatePowerForFlow(float targetFlow, float currentPressure, float pressureLimit) const {
    float maxFlow = calculateFlowRate(currentPressure) * _cps;
    float powerRatio = std::clamp(targetFlow / maxFlow, 0.0f, 1.0f);
    float basePower = powerRatio * 100.0f;

    if (pressureLimit > 0 && currentPressure > pressureLimit) {
        return 0.0f;
    }

    return basePower;
}

void DimmedPump::setFlowTarget(float targetFlow, float pressureLimit) {
    _mode = ControlMode::FLOW;
    _targetFlow = targetFlow;
    _pressureLimit = pressureLimit;
}

void DimmedPump::setPressureTarget(float targetPressure, float flowLimit) {
    _mode = ControlMode::PRESSURE;
    _targetPressure = targetPressure;
    _flowLimit = flowLimit;
}
