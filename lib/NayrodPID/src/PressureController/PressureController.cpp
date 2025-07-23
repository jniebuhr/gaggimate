#include "PressureController.h"
#include "HydraulicParameterEstimator/HydraulicParameterEstimator.h"
#include "SimpleKalmanFilter/SimpleKalmanFilter.h"
#include <algorithm>
#include <math.h>
// Helper function to return the sign of a float
inline float sign(float x) { return (x > 0.0f) - (x < 0.0f); }

PressureController::PressureController(float dt, float *rawSetpoint, float *sensorOutput, float *controllerOutput,
                                       int *ValveStatus) {
    this->_rawSetpoint = rawSetpoint;
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
    _r = *_rawSetpoint;
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

void PressureController::filterSensor() { _filteredPressureSensor = this->pressureKF->updateEstimate(*_rawPressure); }

void PressureController::tare() { coffeeOutput = 0.0; }

void PressureController::update(ControlMode mode) {
    bool isRconverged = R_estimator->hasConverged();
    switch (mode) {
    case ControlMode::PRESSURE: {
        if (isRconverged) { // With R estimated we can gestimate the appropriate pressure setpoint to not go above flow rate
                            // limite
            if (flowPerSecond > _flowLimit) {
                *_rawSetpoint = _flowLimit * this->R_estimator->getResistance();
            }
        } else {
            if (fabs(_r - _filteredPressureSensor) <
                0.2) { // We consider the pressure to be established so pump flow = coffee flow
                if (flowPerSecond > _flowLimit) {
                    *_rawSetpoint *= _flowLimit / flowPerSecond;
                }
            }
        }
        filterSensor();
        filterSetpoint(*_rawSetpoint);
        computePumpDutyCycle();
        break;
    }
    case ControlMode::FLOW: {
        // Coffee flow  = Pressure / R, with the estimated R we can find the appropiate pressure.
        // Without R we can only set the pump to the desired flow rate (which does not say anything about coffee flow rate)
        float pressureSetpointForFlow = *_rawSetpoint * this->R_estimator->getResistance();
        pressureSetpointForFlow = std::clamp(pressureSetpointForFlow, 0.0f, _pressureLimit);
        filterSetpoint(pressureSetpointForFlow);
        if (isRconverged) {
            computePumpDutyCycle();
        } else {
            *_ctrlOutput = 100.0f * _r / (_Q0 * (1 - _filteredPressureSensor / _Pmax));
        }
        break;
    }
    case ControlMode::POWER: {
        *_ctrlOutput = *_rawSetpoint;
        break;
    }

    default:
        break;
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

    // Third order polynomial
    float P = _filteredPressureSensor;
    float P2 = P * P;
    float P3 = P2 * P;
    float Q = PUMP_FLOW_POLY[0] * P3 + PUMP_FLOW_POLY[1] * P2 + PUMP_FLOW_POLY[2] * P + PUMP_FLOW_POLY[3];
    // return Q*1e-6*alpha/100.0f;

    // Afine model base on one Gaggia Classic Pro Unit measurements
    return alpha / 100.0f * (_Q1 * _filteredPressureSensor + _Q0) * 1e-6;
}

float PressureController::getPumpDutyCycleForFlowRate(float desiredPumpFlowRate) const {
    // Afine model base on one Gaggia Classic Pro Unit measurements
    const float availableFlow = _Q1 * _filteredPressureSensor + _Q0;
    return desiredPumpFlowRate / availableFlow * 100.0f;
}

void PressureController::setPumpFlowCoeff(float oneBarFlow, float nineBarFlow) {
    // Set the affine pump flow model coefficients based on flow measurement at 1 bar and 9 bar
    _Q1 = (nineBarFlow - oneBarFlow) / 8;
    _Q0 = oneBarFlow - _Q1 * 1.0f;
}

void PressureController::virtualScale() {

    // Estimate pump output flow
    pumpFlowRate = pumpFlowModel(*_ctrlOutput);
    // Update puck resistance estimation:
    bool isPpressurized = this->R_estimator->update(pumpFlowRate, _filteredPressureSensor);
    float temp_resist = R_estimator->getResistance();
    if (temp_resist != 0.0f)
        puckResistance = temp_resist;
    // Trigger for the estimation flow output
    if (R_estimator->hasConverged()) {
        estimationConvergenceCounter += 1;
    }
    // Flow estimation :
    if (isPpressurized && estimationConvergenceCounter > 10) {
        flowPerSecond = computeAdustedCoffeeFlowRate();
        if (retroCoffeeOutputPressureHistory != 0) {
            // Some coffee might have dripped before flow estimation occured, we need to account for that for the predictive scale
            coffeeOutput += (computeAdustedCoffeeFlowRate(retroCoffeeOutputPressureHistory) + flowPerSecond) * _dt;
            retroCoffeeOutputPressureHistory = 0.0f;
        }
        coffeeOutput += flowPerSecond * _dt;
    } else if (*_rawSetpoint != 0) { // Shot just started (no pressure yet, no R converge but setpoint not 0)
        retroCoffeeOutputPressureHistory += _filteredPressureSensor;
    } else if (estimationConvergenceCounter) { // We're in a low pressure profil phase but we know R ->we can compute flow rate
        flowPerSecond = computeAdustedCoffeeFlowRate();
    } else {
        flowPerSecond = 0.0f;
    }
}

void PressureController::computePumpDutyCycle() {

    // BOILER NOT PRESSURISED : Do not start control before the boiler is filled up.
    // Threshold value needs to be as low as possible while escaping disturbance surge or pressure from the pump
    if (_filteredPressureSensor < 0.5 && *_rawSetpoint != 0) {
        reset();
        *_ctrlOutput = 100.0f;
        return;
    }
    // COMMAND IS ACTUALLY ZERO: The profil is asking for no pressure (ex: blooming phase)
    // Until otherwise, make the controller ready to start as if it is a new shot comming
    // Do not reset the estimation of R since the estimation has to converge still
    if (*_rawSetpoint == 0.0f) {
        initSetpointFilter();
        _errorInteg = 0.0f;
        *_ctrlOutput = 0.0f;
        _P_previous = 0.0f;
        _dP_previous = 0.0f;
        return;
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
    _epsilon = 0.15f * _r;
    deadband = 0.1f * _r;
    float s = _lambda * error + error_dot * 0.1f;
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
    *_ctrlOutput = constrain(alpha * 100.0f, 0.0f, 100.0f);
}

void PressureController::reset() {
    this->R_estimator->reset();
    initSetpointFilter(_filteredPressureSensor);
    _errorInteg = 0.0f;
    retroCoffeeOutputPressureHistory = 0;
    estimationConvergenceCounter = 0;
}
