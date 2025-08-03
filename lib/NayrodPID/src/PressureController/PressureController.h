// PressureController.h
#ifndef PRESSURE_CONTROLLER_H
#define PRESSURE_CONTROLLER_H
#ifndef M_PI
static constexpr float M_PI = 3.14159265358979323846f;
#endif

#include "HydraulicParameterEstimator/HydraulicParameterEstimator.h"
#include "SimpleKalmanFilter/SimpleKalmanFilter.h"
#include <algorithm>
class PressureController {
  public:
    enum class ControlMode { POWER, PRESSURE, FLOW };
    PressureController(float dt, float *_rawPressureSetpoint, float *_rawFlowSetpoint, float *sensorOutput,
                       float *controllerOutput, int *valveStatus);
    void filterSetpoint(float rawSetpoint);
    void initSetpointFilter(float val = 0.0f);
    void setupSetpointFilter(float freq, float damping);

    void setFlowLimit(float lim) { _flowLimit = lim; };
    void setPressureLimit(float lim) { _pressureLimit = lim; };

    float getFilteredSetpoint() const { return _r; };
    float getFilteredSetpointDeriv() const { return _dr; };

    void update(ControlMode mode);
    void tare();
    void reset();

    float getcoffeeOutputEstimate() { return coffeeOutput; };
    float getFilteredPressure() { return _filteredPressureSensor; };
    void setPumpFlowCoeff(float oneBarFlow, float nineBarFlow);
    void setPumpFlowPolyCoeffs(float a, float b, float c, float d);
    float getPumFlowRate() { return pumpFlowModel(*_ctrlOutput); };
    float getCoffeeFlowRate() { return *_ValveStatus == 1 ? flowPerSecond : 0.0f; };
    float getPuckResistance() { return R_estimator->getResistance(); }
    float getEstimatorCovariance() { return R_estimator->getCovariance(); };
    float getPumpDutyCycleForFlowRate() const;

  private:
    float getPumpDutyCycleForPressure();
    void virtualScale();
    void filterSensor();
    float computeAdustedCoffeeFlowRate(float pressure = 0.0f) const;
    float pumpFlowModel(float alpha = 100.0f) const;
    float getAvailableFlow() const;

    float _dt = 1; // Controler frequency sampling

    float *_rawPressureSetpoint = nullptr; // pointer to the Pressure profile current setpoint / limit
    float *_rawFlowSetpoint = nullptr;     // pointer to the flow profile current setpoint / limit
    float *_rawPressure = nullptr;         // pointer to the pressure measurement ,raw output from sensor
    float *_ctrlOutput = nullptr;          // pointer to controller output value of power ratio 0-100%
    int *_ValveStatus = nullptr;           // pointer to 3WV status regarding group head canal open/closed
    int old_ValveStatus = 0;
    float _filteredPressureSensor = 0.0f;
    float _filtfreqHz = 1.0f; // Setpoint filter cuttoff frequency
    float _filtxi = 1.2f;     // Setpoint filter damping ratio
    float _r = 0.0f;          // r[n]     : filtered setpoint
    float _dr = 0.0f;         // dr[n]     : derivative of filtered setpoint
    bool _filterInitialised = false;
    float _flowLimit = 0.0f;
    float _pressureLimit = 0.0f;

    // === System parameters ===
    const float _Co = 6.6e-7f;     // Compliance (m^3/bar)
    float _R = 1e7f;               // Gestimate of the average puck resitance at t=0
    const float _Pmax = 15.0f;     // Pression max (bar)
    const float _maxSpeedP = 9.0f; // bar/s
    float PUMP_FLOW_POLY[4] = {0.0f, 0.0f, -0.5854f, 10.79f};

    // === Controller Gains ===
    float _K = 0.7f;       // Commutation gain
    float _lambda = 1.0f;  // Convergence gain
    float _epsilon = 3.0f; // Limite band
    float deadband = 0.3f; // Dead band
    float _Ki = 0.05f;     // dt/tau
    float _integLimit = 0.8f;
    // === Controller states ===
    float _P_previous = 0.0f;
    float _dP_previous = 0.0f;
    float _errorInteg = 0.0f;
    float alpha = 0.0f;

    // === Flow estimation  ===
    float flowPerSecond = 0.0f;
    float pumpFlowRate = 0.0f;
    float coffeeOutput = 0.0f;
    float retroCoffeeOutputPressureHistory = 0.0f;
    int estimationConvergenceCounter = false;
    float lastGoodEstimatedR = 0.0f;
    float puckResistance = 1e-8f; // Estimation of puck conductance

    SimpleKalmanFilter *pressureKF;
    HydraulicParameterEstimator *R_estimator;
};

#endif // PRESSURE_CONTROLLER_H
