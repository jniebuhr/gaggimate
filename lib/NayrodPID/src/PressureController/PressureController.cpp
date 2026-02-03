// PressureController.cpp
#include "PressureController.h"

#include <algorithm>
#include <cmath>

PressureController::PressureController(float dt, float *rawPressureSetpoint, float *rawFlowSetpoint, float *sensorOutput,
                                       float *controllerOutput, int *valveStatus)
    : _dt(dt),
      _rawPressureSetpoint(rawPressureSetpoint),
      _rawFlowSetpoint(rawFlowSetpoint),
      _rawPressure(sensorOutput),
      _ctrlOutput(controllerOutput),
      _valveStatus(valveStatus),
      _flowEstimator(dt),
      _hydraulicEstimator(dt) {
    // Initialize pressure filter and baseline state.
    _pressureKF = new SimpleKalmanFilter(0.1f, 10.0f, dt * dt);
    _filteredPressure = *_rawPressure;
    _lastFilteredPressure = *_rawPressure;
}

void PressureController::filterSensor() {
    // Filter pressure and derive dP/dt for flow estimation.
    float newFiltered = _pressureKF->updateEstimate(*_rawPressure);
    float dP = (newFiltered - _lastFilteredPressure) / _dt;
    dP = std::clamp(dP, -_pressureDerivativeClamp, _pressureDerivativeClamp);

    float alpha = _dt / (_dt + 1.0f / (2.0f * static_cast<float>(M_PI) * _derivativeFilterFreq));
    _filteredPressureDerivative = alpha * dP + (1.0f - alpha) * _filteredPressureDerivative;

    _lastFilteredPressure = newFiltered;
    _filteredPressure = newFiltered;

    if (_hydraulicEstimator.hasConverged()) {
        _filteredPressure = _hydraulicEstimator.getPressure();
        _filteredPressureDerivative = (_filteredPressure - _lastFilteredPressure) / _dt;
        _puckResistance = _hydraulicEstimator.getResistance();
    }
}

float PressureController::getPumpDutyCycleForFlow() {
    // Compute duty based on available flow and flow target.
    float availableFlow = _hasAvailableFlowOverride ? _availableFlowOverride : 0.0f;
    if (!_hasAvailableFlowOverride && _hydraulicEstimator.hasConverged()) {
        availableFlow = _hydraulicEstimator.getQout();
    }

    if (availableFlow < 1e-3f) {
        return 0.0f;
    }

    float duty = (*_rawFlowSetpoint / availableFlow) * 100.0f;
    return std::clamp(duty, 0.0f, 100.0f);
}

float PressureController::getPumpDutyCycleForPressure() {
    // Simple PI-like pressure control.
    if (*_rawPressureSetpoint < 0.2f) {
        return 0.0f;
    }

    float error = (_filteredPressure - *_rawPressureSetpoint) / _maxPressure;

    _errorIntegral += error * _dt;
    _errorIntegral = std::clamp(_errorIntegral, -_pressureIntegralLimit, _pressureIntegralLimit);

    float u = -_pressureKp * error - _pressureKi * _errorIntegral;
    return std::clamp(u * 100.0f, 0.0f, 100.0f);
}

void PressureController::update(ControlMode mode) {
    // Main control loop: filter, estimate flow, update controller output.
    filterSensor();

    float availableFlow = _hasAvailableFlowOverride ? _availableFlowOverride : 0.0f;
    if (!_hasAvailableFlowOverride && _hydraulicEstimator.hasConverged()) {
        availableFlow = _hydraulicEstimator.getQout();
    }
    _pumpFlowRate = availableFlow * (*_ctrlOutput / 100.0f);

    _flowEstimator.update(_pumpFlowRate, _filteredPressure, _filteredPressureDerivative, *_valveStatus == 1);
    _coffeeFlowRate = _flowEstimator.getFlow();
    if (*_valveStatus == 1) {
        _coffeeOutput += _coffeeFlowRate * _dt;
    }

    _hydraulicEstimator.update(_pumpFlowRate, *_rawPressure);

    if (mode == ControlMode::FLOW) {
        *_ctrlOutput = getPumpDutyCycleForFlow();
    } else if (mode == ControlMode::PRESSURE) {
        *_ctrlOutput = getPumpDutyCycleForPressure();
    }
}

void PressureController::reset() {
    _errorIntegral = 0.0f;
    _coffeeOutput = 0.0f;
    _coffeeFlowRate = 0.0f;
    _pumpFlowRate = 0.0f;
    _puckResistance = 0.0f;
    _flowEstimator.update(0.0f, 0.0f, 0.0f, false);
    _hydraulicEstimator.reset();
}

void PressureController::tare() { reset(); }

void PressureController::injectAvailableFlow(float availableFlowMlPerS) {
    _hasAvailableFlowOverride = true;
    _availableFlowOverride = std::max(0.0f, availableFlowMlPerS);
}

void PressureController::clearAvailableFlow() {
    _hasAvailableFlowOverride = false;
    _availableFlowOverride = 0.0f;
}

void PressureController::setPumpFlowCoeff(float, float) {}

void PressureController::setPumpFlowPolyCoeffs(float, float, float, float) {}
