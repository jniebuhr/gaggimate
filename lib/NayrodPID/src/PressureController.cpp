#include "PressureController.h"
#include "RLS_R_estimator.h"
#include "SimpleKalmanFilter.h"
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
    this->R_estimator = new RLSFilter();
}

void PressureController::filterSetpoint() {
    if (!_filterInitialised)
        initSetpointFilter();
    float _wn = 2 * M_PI * _filtfreqHz;
    float d2r = (_wn * _wn) * (*_rawSetpoint - _r) - 2.0f * _filtxi * _wn * _dr;
    _dr += std::clamp(d2r * _dt, -_maxSpeedP, _maxSpeedP);
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

void PressureController::update() {
    if (*_ValveStatus == 1 && old_ValveStatus == 0)
        reset();
    old_ValveStatus = *_ValveStatus;

    filterSetpoint();
    filterSensor();
    computePumpDutyCycle();
    virtualScale();
}

void PressureController::virtualScale() {
    float Qi_estim = *_ctrlOutput / 100.0f * _Q0 * (1 - _filteredPressureSensor / _Pmax);
    bool isPpressurized = this->R_estimator->update(Qi_estim, _filteredPressureSensor);
    bool isRconverged = R_estimator->getConvergenceScore() > 0.9f;

    if (isRconverged) { // When R confidence will decrease we can rely on the old value saved
        estimationHasConvergedOnce = true;
        lastGoodEstimatedR = this->R_estimator->getEstimate();
    }

    if (isPpressurized && *_ValveStatus == 1 && estimationHasConvergedOnce) {
        flowPerSecond = powf(_filteredPressureSensor / lastGoodEstimatedR * 1e6f, 1 / 1.2); // Instanteneous flow rate
        float memorizedFlow = 0.0f;
        if (retroCoffeeOutputPressureHistory != 0) { // If statement to save up on computation time of pow() function
                                                     // To determine how much coffee has been poured while R wasn't converged
            memorizedFlow = powf(retroCoffeeOutputPressureHistory / lastGoodEstimatedR * 1e6f, 1 / 1.2);
        }
        coffeeOutput += (flowPerSecond + memorizedFlow) * _dt;
        retroCoffeeOutputPressureHistory = 0.0f;
        memorizedFlow = 0.0f;
    } else if (*_ValveStatus == 1) {
        // Shot starts: don't know the puck resitance yet so we just memorise the pressure history to compute the coffee output
        // later Pressure has drop below threshold during shot: Memorise the small pressure level ... not so important
        retroCoffeeOutputPressureHistory += _filteredPressureSensor;
    }
}

void PressureController::computePumpDutyCycle() {

    // BOILER NOT PRESSURISED : Don't control, reset everything meanwhile and go full power
    if (_filteredPressureSensor < 0.5 && *_rawSetpoint != 0) {
        reset();
        *_ctrlOutput = 100.0f;
        ESP_LOGI("PRESSURIZING", "Not there yet");
        return;
    }
    // COMMANDE IS ACTUALLY ZERO: The profil is asking for no pressure (ex: blooming phase)
    // Until otherwise, make the controller ready to start as if a new shot
    // Do not reset the estimation of R since the estimation has to converge still
    if (*_rawSetpoint == 0.0f) {
        initSetpointFilter();
        _errorInteg = 0.0f;
        *_ctrlOutput = 0.0f;
        _P_previous = 0.0f;
        _dP_previous = 0.0f;
        return;
    }

    // DO CONTROL: The boiler is pressurise, the profil is something specific, let's try to
    // control that pressure now that all conditions are reunited
    float P = _filteredPressureSensor;
    float P_ref = _r;
    float dP_ref = _dr;

    float error = P - P_ref;
    float dP_actual = 0.3 * _dP_previous + 0.7 * (P - _P_previous) / _dt;
    _dP_previous = dP_actual;
    float error_dot = dP_actual - dP_ref;
    _P_previous = P;

    // Adaptive gains
    float K = _K * (1 - P / _Pmax);
    float Ki = _Ki / (1 - P / _Pmax);

    // Switching surface
    float s = _lambda * error + error_dot * 0.1;
    float sat_s = tanhf(s / _epsilon);
    float Qa = _Q0 * (1 - P / _Pmax);

    // Integrator
    _errorInteg += error * _dt;
    float iterm = Ki * _errorInteg;
    alpha = _Co / Qa * (-_lambda * error - K * sat_s) - iterm;

    // Antiwindup
    if ((sign(error) == -sign(alpha)) && (fabs(alpha) > 1.0f)) {
        _errorInteg -= error * _dt;
        iterm = Ki * _errorInteg;
        ESP_LOGI("CLAMP I", "");
    }
    alpha = _Co / Qa * (-_lambda * error - K * sat_s) - iterm;
    *_ctrlOutput = std::clamp(alpha * 100.0f, 0.0f, 100.0f);
    ESP_LOGI("", "P:%.2f(bar)\tdP:%.2e(bar/s)\tP_ref:%.2e(bar)\tdP_ref:%.2e(bar/s)\tIterm:%.1f%\tKsat:%1.2e\tOutput:%.1f%", P,
             dP_actual, P_ref, dP_ref, iterm, K * sat_s, *_ctrlOutput);
}

void PressureController::reset() {
    this->R_estimator->reset();
    initSetpointFilter();
    _errorInteg = 0.0f;
    retroCoffeeOutputPressureHistory = 0;
    estimationHasConvergedOnce = false;
}
