#include "SimpleKalmanFilter.h"
#include "Arduino.h"
#include <math.h>

SimpleKalmanFilter::SimpleKalmanFilter(float mea_e, float est_e, float q) {
    _err_measure = mea_e;      // R - Measurement noise covariance
    _err_estimate = est_e;     // P - Error covariance
    _q = q;                    // Q - Process noise covariance
    _current_estimate = mea_e; // Initialize estimate
    _last_estimate = mea_e;    // Initialize previous estimate
    _kalman_gain = 0.0;        // Initialize Kalman gain
}

float SimpleKalmanFilter::updateEstimate(float mea) {
    _err_estimate = _err_estimate + _q;
    _kalman_gain = _err_estimate / (_err_estimate + _err_measure);
    _current_estimate = _last_estimate + _kalman_gain * (mea - _last_estimate);
    _err_estimate = (1.0 - _kalman_gain) * _err_estimate;
    _last_estimate = _current_estimate;

    return _current_estimate;
}

void SimpleKalmanFilter::setMeasurementError(float mea_e) { _err_measure = mea_e; }

void SimpleKalmanFilter::setEstimateError(float est_e) { _err_estimate = est_e; }

void SimpleKalmanFilter::setProcessNoise(float q) { _q = q; }

float SimpleKalmanFilter::getKalmanGain() { return _kalman_gain; }

float SimpleKalmanFilter::getCurrentEstimate() { return _current_estimate; }

float SimpleKalmanFilter::getErrorCovariance() { return _err_estimate; }