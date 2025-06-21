// PressureController.h
#ifndef PRESSURE_CONTROLLER_H
#define PRESSURE_CONTROLLER_H
#ifndef M_PI
static constexpr float M_PI = 3.14159265358979323846f;
#endif
#include "RLS_R_estimator.h"
#include "SimpleKalmanFilter.h"
class PressureController {
  public:
    PressureController(float dt, float *rawSetpoint, float *sensorOutput, float *controllerOutput, int *valveStatus);
    void filterSetpoint();
    void initSetpointFilter(float val =0.0f);
    void setupSetpointFilter(float freq, float damping);

    float getFilteredSetpoint() const { return _r; };
    float getFilteredSetpointDeriv() const { return _dr; };

    void update();
    void filterSensor();
    void tare();

    void computePumpDutyCycle();
    void virtualScale();
    void reset();

    float getFlowPerSecond() { return flowPerSecond; };
    float getcoffeeOutputEstimate() { return coffeeOutput; };
    float getFilteredPressure() { return _filteredPressureSensor; };

  private:
    float _dt = 1; // Controler frequency sampling

    float *_rawSetpoint = nullptr; // pointer to the Pressure profile current setpoint
    float *_rawPressure = nullptr; // pointer to the pressure measurement ,raw output from sensor
    float *_ctrlOutput = nullptr;  // pointer to controller output value of power ratio 0-100%
    int *_ValveStatus = nullptr;     // pointer to OPV status regarding group head canal open/closed
    int old_ValveStatus = 0;
    float _filteredPressureSensor = 0.0f;
    float _filtfreqHz = 1.0f; // Setpoint filter cuttoff frequency
    float _filtxi = 1.2f;     // Setpoint filter damping ratio
    float _r = 0.0f;          // r[n]     : filtered setpoint
    float _dr = 0.0f;         // dr[n]     : derivative of filtered setpoint
    bool _filterInitialised = false;

    // === Paramètres système ===
    const float _Co = 6.6e-7f;   // Compliance (m^3/bar)
    float _R = 1e7f; // Gestimate of the average puck resitance at t=0
    const float _Q0 = 14e-6f*0.79;  // Débit max à P = 0 (m^3/s)
    const float _Pmax = 15.0f; // Pression max (bar)
    const float _maxSpeedP = 9.0f; // bar/s

    // === Paramètres Controller ===
    float _K = 7; // Commutation gain 
    float _lambda = 3;  // Convergence gain 
    float _epsilon = 2.0f;  // Limite band
    float _rho = _K * 0.0f; // Uncertainty
    float _Ki = 0.05 ;  // dt/tau
    float _integLimit = 0.8f;

    float _P_previous = 0.0f;
    float _dP_previous = 0.0f;
    float _errorInteg = 0.0f;

    float alpha = 0.0f;

    float flowPerSecond = 0.0f;
    float coffeeOutput = 0.0f;
    float retroCoffeeOutputPressureHistory = 0.0f;
    bool estimationHasConvergedOnce = false;
    float lastGoodEstimatedR = 0.0f;

    SimpleKalmanFilter *pressureKF;
    RLSFilter *R_estimator;
};

#endif // PRESSURE_CONTROLLER_H
