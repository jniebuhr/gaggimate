#include "TwoStateKalmanFilter.h"
#include <math.h>

// Initial rate variance after reset; large enough to converge within a few samples
constexpr float INITIAL_RATE_VARIANCE = 25.0f;

TwoStateKalmanFilter::TwoStateKalmanFilter(float dt, float mea_e, float accel_q, float rate_leak)
    : _dt(dt), _err_measure(mea_e), _rate_leak(rate_leak) {
    // Piecewise-constant acceleration model: Q = accel_q * [dt^4/4, dt^3/2; dt^3/2, dt^2]
    _q00 = accel_q * dt * dt * dt * dt / 4.0f;
    _q01 = accel_q * dt * dt * dt / 2.0f;
    _q11 = accel_q * dt * dt;
}

void TwoStateKalmanFilter::reset() {
    _initialized = false;
    _position = 0.0f;
    _velocity = 0.0f;
}

float TwoStateKalmanFilter::updateEstimate(float mea) {
    if (!_initialized) {
        _position = mea;
        _velocity = 0.0f;
        _p00 = _err_measure;
        _p01 = _p10 = 0.0f;
        _p11 = INITIAL_RATE_VARIANCE;
        _initialized = true;
        return _position;
    }

    // Predict: x = F*x, P = F*P*F' + Q with F = [1, dt; 0, 1]
    _velocity *= _rate_leak;
    _position += _velocity * _dt;
    float p00 = _p00 + _dt * (_p10 + _p01) + _dt * _dt * _p11 + _q00;
    float p01 = _p01 + _dt * _p11 + _q01;
    float p10 = _p10 + _dt * _p11 + _q01;
    float p11 = _p11 + _q11;

    // Update with a position-only measurement (H = [1, 0])
    float s = p00 + _err_measure;
    float k0 = p00 / s;
    float k1 = p10 / s;
    // Cap the rate gain at critical damping (beta <= 2 - alpha - 2*sqrt(1-alpha)); the pure
    // Kalman gains are underdamped and ring, turning noise into visible periodic waves.
    // P below keeps the uncapped gains so the covariance steady state is unaffected.
    float k1_used = fminf(k1, (2.0f - k0 - 2.0f * sqrtf(1.0f - k0)) / _dt);
    float innovation = mea - _position;
    _position += k0 * innovation;
    _velocity += k1_used * innovation;
    _p00 = (1.0f - k0) * p00;
    _p01 = (1.0f - k0) * p01;
    _p10 = p10 - k1 * p00;
    _p11 = p11 - k1 * p01;

    return _position;
}
