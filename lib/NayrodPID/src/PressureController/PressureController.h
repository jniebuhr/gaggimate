// PressureController.h
#ifndef PRESSURE_CONTROLLER_H
#define PRESSURE_CONTROLLER_H
#ifndef M_PI
static constexpr float M_PI = 3.14159265358979323846f;
#endif

#include "FlowEstimator.h"
#include "FlowMap.h"
#include "HydraulicParameterEstimator/HydraulicParameterEstimator.h"
#include "SimpleKalmanFilter/SimpleKalmanFilter.h"
#include <algorithm>
#include <cmath>

class PressureController {
  public:
    enum class ControlMode { POWER, PRESSURE, FLOW };

    // Pressure/flow controller with optional hydraulic estimator support.
    PressureController(float dt, float *rawPressureSetpoint, float *rawFlowSetpoint, float *sensorOutput, float *controllerOutput,
                       int *valveStatus);

    void update(ControlMode mode);
    void reset();
    void tare();

    float getCoffeeOutputEstimate() const { return std::fmax(0.0f, _coffeeOutput); }
    float getCoffeeFlowRate() const { return _coffeeFlowRate; }
    float getPumpFlowRate() const { return _pumpFlowRate; }
    float getPuckResistance() const { return _puckResistance; }

    void injectAvailableFlow(float availableFlowMlPerS);
    void clearAvailableFlow();

    void setPumpFlowCoeff(float oneBarFlow, float nineBarFlow);
    void setPumpFlowPolyCoeffs(float a, float b, float c, float d);

  private:
    void filterSensor();
    float getPumpDutyCycleForPressure();
    float getPumpDutyCycleForFlow();

    float _dt = 1.0f;

    float *_rawPressureSetpoint = nullptr;
    float *_rawFlowSetpoint = nullptr;
    float *_rawPressure = nullptr;
    float *_ctrlOutput = nullptr;
    int *_valveStatus = nullptr;

    SimpleKalmanFilter *_pressureKF = nullptr;
    float _filteredPressure = 0.0f;
    float _filteredPressureDerivative = 0.0f;
    float _lastFilteredPressure = 0.0f;

    FlowEstimator _flowEstimator;
    HydraulicParameterEstimator _hydraulicEstimator;

    float _pumpFlowRate = 0.0f;
    float _coffeeFlowRate = 0.0f;
    float _coffeeOutput = 0.0f;
    float _puckResistance = 0.0f;

    float _errorIntegral = 0.0f;
    float _pressureIntegralLimit = 1.0f;
    float _pressureKp = 0.15f;
    float _pressureKi = 0.05f;

    const float _maxPressure = 15.0f;
    const float _pressureDerivativeClamp = 20.0f;
    const float _derivativeFilterFreq = 2.0f;

    bool _hasAvailableFlowOverride = false;
    float _availableFlowOverride = 0.0f;
};

#endif // PRESSURE_CONTROLLER_H
