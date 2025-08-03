#ifndef DIMMEDPUMP_H
#define DIMMEDPUMP_H
#include "PSM.h"
#include "PressureController/PressureController.h"
#include "PressureSensor.h"
#include "Pump.h"
#include <Arduino.h>

class DimmedPump : public Pump {
  public:
    enum class ControlMode { POWER, PRESSURE, FLOW };

    DimmedPump(uint8_t ssr_pin, uint8_t sense_pin, PressureSensor *pressureSensor);
    ~DimmedPump() = default;

    void setup() override;
    void loop() override;
    void setPower(float setpoint) override;

    float getCoffeeVolume();
    float getPumpFlow();
    float getPuckFlow();
    void tare();

    void setFlowTarget(float targetFlow, float pressureLimit);
    void setPressureTarget(float targetPressure, float flowLimit);
    void setPumpFlowCoeff(float oneBarFlow, float nineBarFlow);
    void setPumpFlowPolyCoeffs(float a, float b, float c, float d);
    void stop();
    void fullPower();
    void setValveState(bool open);

  private:
    uint8_t _ssr_pin;
    uint8_t _sense_pin;
    PSM _psm;
    PressureSensor *_pressureSensor;
    PressureController _pressureController;
    xTaskHandle taskHandle;

    ControlMode _mode = ControlMode::POWER;
    float _power = 0.0f;
    float _controllerPower = 0.0f;
    float _ctrlPressure = 0.0f;
    float _ctrlFlow = 0.0f;
    float _currentPressure = 0.0f;
    float _currentFlow = 0.0f;
    float _lastPressure = 0.0f;
    int _valveStatus = 0;
    int _cps = MAX_FREQ;

    float _opvPressure = 0.0f;

    static constexpr float BASE_FLOW_RATE = 0.25f;
    static constexpr float MAX_PRESSURE = 15.0f;
    static constexpr float MAX_FREQ = 60.0f;

    void updatePower();
    void onPressureUpdate(float pressure);

    const char *LOG_TAG = "DimmedPump";
    static void loopTask(void *arg);
};

#endif // DIMMEDPUMP_H
