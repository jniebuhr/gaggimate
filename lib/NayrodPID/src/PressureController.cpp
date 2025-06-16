#include "PressureController.h"
#include "RLS_R_estimator.h"
#include "SimpleKalmanFilter.h"
#include <math.h>
// Helper function to return the sign of a float
inline float sign(float x) { return (x > 0.0f) - (x < 0.0f); }

PressureController::PressureController(float dt, float *rawSetpoint, float *sensorOutput, float *controllerOutput,
                                       int *OPVStatus) {
    this->_rawSetpoint = rawSetpoint;
    this->_rawPressure = sensorOutput;
    this->_ctrlOutput = controllerOutput;
    this->_OPVStatus = OPVStatus;
    this->_dt = dt;

    this->pressureKF = new SimpleKalmanFilter(0.1f, 10.0f, powf(3 * _dt, 2));
    this->_P_previous = *sensorOutput;
    this->R_estimator = new RLSFilter();
}

void PressureController::filterSetpoint() {
    if (!_filterInitialised)
        initSetpointFilter();
    float _wn = 2 * M_PI * _filtfreqHz;
    float d2r = (_wn * _wn) * (*_rawSetpoint - _r) - 2.0f * _filtxi * _wn * _dr;
    _dr += d2r * _dt;
    _r += _dr * _dt;
}

void PressureController::initSetpointFilter() {
    _r = *_rawSetpoint;
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

void PressureController::update() {
    filterSetpoint();
    filterSensor();
    computePumpDutyCycle();
    virtualScale();
}

void PressureController::virtualScale() {
    float Qi_estim = *_ctrlOutput / 100.0f * _Q0 * (1 - _filteredPressureSensor / _Pmax);
    bool isPpressurized = this->R_estimator->update(Qi_estim, _filteredPressureSensor);
    bool isRconverged = R_estimator->getConvergenceScore() > 0.9f;
    bool isPrefReached = fabsf(_r - _filteredPressureSensor) < 0.2;
    if (isPpressurized && *_OPVStatus == 1 && isRconverged) {
        flowPerSecond =
            powf((_filteredPressureSensor + retroCoffeeOutputPressureHistory) / this->R_estimator->getEstimate() * 1e6f, 1 / 1.2);
        coffeeOutput += flowPerSecond * _dt;
        retroCoffeeOutputPressureHistory = 0.0f;
    } else {
        flowPerSecond = 0.0f;
        if (isPrefReached)
            retroCoffeeOutputPressureHistory += _filteredPressureSensor;
    }
    // ESP_LOGI("","%1.2e",this->R_estimator->getEstimate());
}

void PressureController::computePumpDutyCycle() {
    float P = _filteredPressureSensor;
    float P_ref = _r;
    float dP_ref = _dr;

    float error = P - P_ref;
    float dP_actual = (P - _P_previous) / _dt;
    float error_dot = dP_actual - dP_ref;

    _P_previous = P;

    float s = _lambda * error + 0.1 * error_dot;
    float sat_s = tanhf(s / _epsilon);

    _errorInteg += error * _dt;
    float iterm = _Ki * _errorInteg;
    if ((sign(error) == sign(_errorInteg)) && (fabs(iterm) > _integLimit)) {
        _errorInteg -= error * _dt;
        iterm = _Ki * _errorInteg;
    }
    _K = _K * (1.0f - 0.5 * P_ref / _Pmax);
    alpha = -(_K + 0.1 * fabsf(s)) * sat_s + _rho * sign(s) - _Ki * iterm;
    alpha = std::clamp(alpha, 0.0f, 1.0f);

    *_ctrlOutput = alpha * 100.0f;

    ESP_LOGI("",
             "Time:%1.2f(s)\tP_ref:%1.2f(bar)\tP_ref_filt:%1.2f(bar)\tP_filt:%1.2f(bar)\tCoffee:%1.2f(g)\tR:%1.2e(bar.s/m3)\tR "
             "score:%1.2f(0-1)",
             (float)millis() / 1000.0, *_rawSetpoint, this->getFilteredSetpoint(), this->getFilteredPressure(), coffeeOutput,
             this->R_estimator->getEstimate(), this->R_estimator->getConvergenceScore());
}

void PressureController::reset() {
    this->R_estimator->reset();
    initSetpointFilter();
    _errorInteg = 0.0f;
    retroCoffeeOutputPressureHistory = 0;
}
