// PressureController.h
#ifndef PRESSURE_CONTROLLER_H
#define PRESSURE_CONTROLLER_H
#ifndef M_PI
static constexpr float M_PI = 3.14159265358979323846f;
#endif

#include "SimpleKalmanFilter/SimpleKalmanFilter.h"
#include <algorithm>

class PressureController {
  private:
    // Utility function for first-order low-pass filtering
    static void applyLowPassFilter(float* filteredValue, float rawValue, float cutoffFreq, float dt);
  public:
    enum class ControlMode { POWER, PRESSURE, FLOW };
    PressureController(float dt, float *_rawPressureSetpoint, float *_rawFlowSetpoint, float *sensorOutput,
                       float *controllerOutput, int *valveStatus);
    void initSetpointFilter(float val = 0.0f);

    void setFlowLimit(float lim) { /* Flow limit not currently implemented */ };
    void setPressureLimit(float lim) { /* Pressure limit not currently implemented */ };


    void update(ControlMode mode);
    void tare();
    void reset();

    float getCoffeeOutputEstimate() { return std::fmax(0.0f, _coffeeOutput); };
    void setPumpFlowCoeff(float oneBarFlow, float nineBarFlow);
    void setPumpFlowPolyCoeffs(float a, float b, float c, float d);
    float getPumpFlowRate() { return _pumpFlowRate; };
    float getCoffeeFlowRate() { return *_valveStatus == 1 ? _coffeeFlowRate : 0.0f; };
    float getPuckResistance() { return _puckResistance; }

    void setDeadVolume(float deadVol){_puckSaturatedVolume = deadVol;};

  private:
    float getPumpDutyCycleForPressure();
    void virtualScale();
    void filterSensor();
    void filterSetpoint(float rawSetpoint);
    float pumpFlowModel(float alpha = 100.0f) const;
    float getAvailableFlow() const;
    float getPumpDutyCycleForFlowRate() const;

    float _dt = 1.0f; // Controller sampling period (seconds)

    // Input/output pointers
    float* _rawPressureSetpoint = nullptr; // Pressure profile current setpoint/limit (bar)
    float* _rawFlowSetpoint = nullptr;     // Flow profile current setpoint/limit (ml/s)
    float* _rawPressure = nullptr;         // Raw pressure measurement from sensor (bar)
    float* _ctrlOutput = nullptr;          // Controller output power ratio (0-100%)
    int* _valveStatus = nullptr;           // 3-way valve status (group head open/closed)
    
    // Filtered values
    float _filteredPressureSensor = 0.0f;  // Filtered pressure sensor reading (bar)
    float _filteredSetpoint = 0.0f;        // Filtered pressure setpoint (bar)
    float _filteredSetpointDerivative = 0.0f; // Derivative of filtered setpoint (bar/s)
    float _filteredPressureDerivative = 0.0f;  // Derivative of filtered pressure (bar/s)
    
    // Setpoint filter parameters
    float _setpointFilterFreq = 1.0f;      // Setpoint filter cutoff frequency (Hz)
    float _setpointFilterDamping = 1.2f;   // Setpoint filter damping ratio
    bool _setpointFilterInitialized = false;
    

    // === System parameters ===
    const float _systemCompliance = 1.4f;  // System compliance (ml/bar)
    float _puckResistance = 1e7f;           // Initial estimate of puck resistance
    const float _maxPressure = 15.0f;       // Maximum pressure (bar)
    const float _maxPressureRate = 9.0f;    // Maximum pressure rate (bar/s)
    float _pumpFlowCoefficients[4] = {0.0f, 0.0f, -0.5854f, 10.79f}; // Pump flow polynomial coefficients

    // === Controller Gains ===
    float _commutationGain = 0.7f;     // Commutation gain
    float _convergenceGain = 1.0f;     // Convergence gain
    float _epsilonCoefficient = 0.3f;  // Limit band coefficient
    float _deadbandCoefficient = 0.1f; // Dead band coefficient
    float _integralGain = 0.25f;       // Integral gain (dt/tau)
    
    // === Controller states ===
    float _previousPressure = 0.0f;    // Previous pressure reading (bar)
    float _errorIntegral = 0.0f;       // Integral of pressure error
    float _pumpDutyCycle = 0.0f;       // Calculated pump duty cycle (0-100%)

    // === Flow estimation ===
    float _waterThroughPuckFlowRate = 0.0f;      // Water through puck flow rate (ml/s)
    float _pumpFlowRate = 0.0f;        // Pump flow rate (ml/s)
    float _pumpVolume = 0.0f;          // Total pump volume (ml)
    float _coffeeOutput = 0.0f;        // Total coffee output (ml)
    float _coffeeFlowRate = 0.0f;      // Coffee output flow rate (mL/s)
    float _lastFilteredPressure = 0.0f; // Previous filtered pressure for derivative calculation
    float _filterEstimatorFrequency = 1.0f; // Filter frequency for estimator
    float _puckSaturationVolume = 0.0f;// Total volume to saturate the puck(ml)
    float _puckSaturatedVolume = 38.0f; // Volume at puck saturation (ml)
    float _lastPuckResistance = 0.0f; // Previous puck resistance for derivative calculation
    float _puckResistanceDerivative = 0.0f; // Derivative of puck resistance
    bool _coffeStartedToFlow  = false;
    float _missedDops = 0.0f; // Coffee volume first drip compensation

    SimpleKalmanFilter *_pressureKalmanFilter;
};

#endif // PRESSURE_CONTROLLER_H
