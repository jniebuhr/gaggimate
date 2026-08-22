#ifndef TwoStateKalmanFilter_h
#define TwoStateKalmanFilter_h

// Constant-velocity Kalman filter for a noisy scalar: tracks value and rate of
// change, so heavy smoothing does not lag ramps like a single-state filter.
class TwoStateKalmanFilter {
  public:
    // dt: sample period in seconds
    // mea_e: measurement noise covariance (R)
    // accel_q: process noise of rate changes (Q scale, in (unit/s^2)^2)
    // rate_leak: per-sample decay of the rate state; <1 damps overshoot after ramps
    TwoStateKalmanFilter(float dt, float mea_e, float accel_q, float rate_leak = 1.0f);

    // Update with a new measurement, returns the filtered value
    float updateEstimate(float mea);
    void reset();

    float getCurrentEstimate() const { return _position; }
    float getRateEstimate() const { return _velocity; }

  private:
    float _dt;
    float _err_measure; // R - measurement noise covariance
    float _rate_leak;
    float _q00, _q01, _q11; // Q - process noise covariance entries
    bool _initialized = false;
    float _position = 0.0f;
    float _velocity = 0.0f;
    float _p00 = 0.0f, _p01 = 0.0f, _p10 = 0.0f, _p11 = 0.0f; // P - error covariance
};

#endif
