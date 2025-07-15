#ifndef SimpleKalmanFilter_h
#define SimpleKalmanFilter_h

#include "Arduino.h"

class SimpleKalmanFilter {
  public:
    // Constructor
    // mea_e: measurement noise covariance (R)
    // est_e: initial error covariance (P)
    // q: process noise covariance (Q)
    SimpleKalmanFilter(float mea_e, float est_e, float q);

    // Update the filter with a new measurement
    float updateEstimate(float mea);

    // Setters for filter parameters
    void setMeasurementError(float mea_e);
    void setEstimateError(float est_e);
    void setProcessNoise(float q);

    // Getters for monitoring
    float getKalmanGain();
    float getCurrentEstimate();
    float getErrorCovariance();

  private:
    float _err_measure;      // R - Measurement noise covariance
    float _err_estimate;     // P - Error covariance
    float _q;                // Q - Process noise covariance
    float _current_estimate; // Current state estimate
    float _last_estimate;    // Previous state estimate
    float _kalman_gain;      // Kalman gain
};

#endif