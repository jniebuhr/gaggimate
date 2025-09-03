#include "PressureController.h"
#include "HydraulicParameterEstimator/HydraulicParameterEstimator.h"
#include "SimpleKalmanFilter/SimpleKalmanFilter.h"
#include <algorithm>
#include <math.h>
// Helper function to return the sign of a float
inline float sign(float x) { return (x > 0.0f) - (x < 0.0f); }

PressureController::PressureController(float dt, float *rawPressureSetpoint, float *rawFlowSetpoint, float *sensorOutput,
                                       float *controllerOutput, int *ValveStatus) {
    this->_rawPressureSetpoint = rawPressureSetpoint;
    this->_rawFlowSetpoint = rawFlowSetpoint;
    this->_rawPressure = sensorOutput;
    this->_ctrlOutput = controllerOutput;
    this->_ValveStatus = ValveStatus;
    this->_dt = dt;

    this->pressureKF = new SimpleKalmanFilter(0.1f, 10.0f, powf(4 * _dt, 2));
    this->_P_previous = *sensorOutput;
    this->R_estimator = new HydraulicParameterEstimator(dt);
}

void PressureController::filterSetpoint(float rawSetpoint) {
    if (!_filterInitialised)
        initSetpointFilter();
    float _wn = 2.0 * M_PI * _filtfreqHz;
    float d2r = (_wn * _wn) * (rawSetpoint - _r) - 2.0f * _filtxi * _wn * _dr;
    _dr += constrain(d2r * _dt, -_maxSpeedP, _maxSpeedP);
    _r += _dr * _dt;
}

void PressureController::initSetpointFilter(float val) {
    _r = *_rawPressureSetpoint;
    if (val != 0.0f)
        _r = val;
    _dr = 0.0f;
    _filterInitialised = true;
}

void PressureController::setupSetpointFilter(float freq, float damping) {
    // Reset the filter if values have changed
    if (_filtxi != damping || _filtfreqHz != freq)
        initSetpointFilter();
    _filtfreqHz = freq;
    _filtxi = damping;
}

void PressureController::filterSensor() {
    float newFiltered = this->pressureKF->updateEstimate(*_rawPressure);
    float alpha = 0.5f / (0.5f + _dt);
    _dFilteredPressure = alpha * _dFilteredPressure + (1.0f - alpha) * ((newFiltered - _lastFilteredPressure) / _dt);
    _lastFilteredPressure = newFiltered;
    _filteredPressureSensor = newFiltered;
}

void PressureController::tare() {
    coffeeOutput = 0.0;
    coffeeBadVolume = 0.0f;
    pumpVolume = 0.0f;
}

void PressureController::update(ControlMode mode) {
    old_ValveStatus = *_ValveStatus;
    filterSetpoint(*_rawPressureSetpoint);
    filterSensor();

    if ((mode == ControlMode::FLOW || mode == ControlMode::PRESSURE) && *_rawPressureSetpoint > 0.0f &&
        *_rawFlowSetpoint > 0.0f) {
        float flowOutput = getPumpDutyCycleForFlowRate();
        float pressureOutput = getPumpDutyCycleForPressure();
        *_ctrlOutput = std::min(flowOutput, pressureOutput);
        if (flowOutput < pressureOutput) {
            _errorInteg = 0.0f; // Reset error buildup in flow target
        }
    } else if (mode == ControlMode::FLOW) {
        *_ctrlOutput = getPumpDutyCycleForFlowRate();
    } else if (mode == ControlMode::PRESSURE) {
        *_ctrlOutput = getPumpDutyCycleForPressure();
    }
    virtualScale();
}

float PressureController::computeAdustedCoffeeFlowRate(float pressure) const {
    if (pressure == 0.0f) {
        pressure = _filteredPressureSensor;
    }
    float Q = sqrtf(fmax(pressure, 0.0f)) * puckResistance * 1e6f;
    return Q;
}

float PressureController::pumpFlowModel(float alpha) const {
    const float availableFlow = getAvailableFlow();
    return availableFlow * 1e-6 * alpha / 100.0f;
}

float PressureController::getAvailableFlow() const {
    const float P = _filteredPressureSensor;
    const float P2 = P * P;
    const float P3 = P2 * P;
    const float Q = PUMP_FLOW_POLY[0] * P3 + PUMP_FLOW_POLY[1] * P2 + PUMP_FLOW_POLY[2] * P + PUMP_FLOW_POLY[3];

    return Q;
}

float PressureController::getPumpDutyCycleForFlowRate() const {
    const float availableFlow = getAvailableFlow();
    if (availableFlow <= 0.0f) {
        return 0.0f;
    }
    return *_rawFlowSetpoint / availableFlow * 100.0f;
}

void PressureController::setPumpFlowCoeff(float oneBarFlow, float nineBarFlow) {
    // Set the affine pump flow model coefficients based on flow measurement at 1 bar and 9 bar
    PUMP_FLOW_POLY[0] = 0.0f;
    PUMP_FLOW_POLY[1] = 0.0f;
    PUMP_FLOW_POLY[2] = (nineBarFlow - oneBarFlow) / 8;
    PUMP_FLOW_POLY[3] = oneBarFlow - PUMP_FLOW_POLY[2] * 1.0f;
}

void PressureController::setPumpFlowPolyCoeffs(float a, float b, float c, float d) {
    PUMP_FLOW_POLY[0] = a;
    PUMP_FLOW_POLY[1] = b;
    PUMP_FLOW_POLY[2] = c;
    PUMP_FLOW_POLY[3] = d;
}

void PressureController::virtualScale() {
    // Estimate puck input flow
    if (pumpVolume < deadVolume) { // Proportionnaly increase flow rate at the beginning
        float flow = pumpFlowModel(*_ctrlOutput) * 1e6f;
        pumpFlowInstant += flow * _dt;
        pumpFlowRate = pumpFlowInstant * flow / 8.0f;
    } else {
        // pumpFlowRate = pumpFlowModel(*_ctrlOutput)*1e6f;
        float alpha = 0.3 / (0.3 + _dt);
        pumpFlowRate = pumpFlowModel(*_ctrlOutput) * 1e6f * alpha + pumpFlowRate * (1 - alpha);
    }
    pumpVolume += pumpFlowRate * _dt;

    // Update puck resistance estimation:
    float badFlow = 0.0f;
    bool isPpressurized = this->R_estimator->update(pumpFlowRate, _filteredPressureSensor);
    flowPerSecond = R_estimator->getQout();
    if (flowPerSecond > 0.0f) {
        badFlow = pumpFlowRate - R_estimator->getCeff() * _dFilteredPressure;
        coffeeBadVolume += badFlow * _dt;
        if (coffeeBadVolume > 15.0f) {
            coffeeOutput += flowPerSecond * _dt;
        } else {
            flowPerSecond = 0.0f;
        }
    }
    ESP_LOGV("", "%.2e\t%.2e\t%.2e\t%.2e\t%.2e\t%.2e\t%.2e", badFlow, coffeeBadVolume, R_estimator->getPressure(),
             _filteredPressureSensor, R_estimator->getResistance(), R_estimator->getQout(), R_estimator->getCovarianceK());
}

float PressureController::getPumpDutyCycleForPressure() {

    // BOILER NOT PRESSURISED : Do not start control before the boiler is filled up.
    // Threshold value needs to be as low as possible while escaping disturbance surge or pressure from the pump
    if (_filteredPressureSensor < 0.5 && *_rawPressureSetpoint != 0) {
        *_ctrlOutput = 100.0f;
        return 100.0f;
    }
    // COMMAND IS ACTUALLY ZERO: The profil is asking for no pressure (ex: blooming phase)
    // Until otherwise, make the controller ready to start as if it is a new shot comming
    // Do not reset the estimation of R since the estimation has to converge still
    if (*_rawPressureSetpoint == 0.0f) {
        initSetpointFilter();
        _errorInteg = 0.0f;
        *_ctrlOutput = 0.0f;
        _P_previous = 0.0f;
        _dP_previous = 0.0f;
        return 0.0f;
    }

    // CONTROL: The boiler is pressurised, the profil is something specific, let's try to
    // control that pressure now that all conditions are reunited
    float P = _filteredPressureSensor;
    float P_ref = _r;
    float dP_ref = _dr;

    float error = P - P_ref;
    float dP_actual = 0.3f * _dP_previous + 0.7f * (P - _P_previous) / _dt;
    _dP_previous = dP_actual;
    float error_dot = dP_actual - dP_ref;

    _P_previous = P;

    // Switching surface
    _epsilon = 0.3f * _r;
    deadband = 0.1f * _r;

    float s = _lambda * error;
    float sat_s = 0.0f;
    if (error > 0) {
        float tan = tanhf(s / _epsilon - deadband * _lambda / _epsilon);
        sat_s = std::max(0.0f, tan);
    } else if (error < 0) {
        float tan = tanhf(s / _epsilon + deadband * _lambda / _epsilon);
        sat_s = std::min(0.0f, tan);
    }

    // Integrator
    float Ki = _Ki / (1 - P / _Pmax);
    _errorInteg += error * _dt;
    float iterm = Ki * _errorInteg;

    float Qa = pumpFlowModel();
    float K = _K / (1 - P / _Pmax) * Qa / _Co;
    alpha = _Co / Qa * (-_lambda * error - K * sat_s) - iterm;

    // Anti-windup
    if ((sign(error) == -sign(alpha)) && (fabs(alpha) > 1.0f)) {
        _errorInteg -= error * _dt;
        iterm = Ki * _errorInteg;
    }

    alpha = _Co / Qa * (-_lambda * error - K * sat_s) - iterm;
    return constrain(alpha * 100.0f, 0.0f, 100.0f);
}

void PressureController::reset() {
    this->R_estimator->reset();
    initSetpointFilter(_filteredPressureSensor);
    _errorInteg = 0.0f;
    retroCoffeeOutputPressureHistory = 0;
    estimationConvergenceCounter = 0;
    timer = 0.0f;
    pumpFlowInstant = 0.0f;
    ESP_LOGI("", "RESET");
}
