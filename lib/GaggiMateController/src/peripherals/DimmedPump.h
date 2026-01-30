#ifndef DIMMEDPUMP_H
#define DIMMEDPUMP_H

#include <Arduino.h>
#include <SoftWire.h>

#include "FlowMap.h"
#include "MCP4725.h"
#include "PSM.h"
#include "PressureController/PressureController.h"
#include "PressureSensor.h"
#include "Pump.h"
#include "RpmSensor.h"

class DimmedPump : public Pump {
  public:
    enum class ControlMode { POWER, PRESSURE, FLOW };

    // Dimmed pump controller for gear-pump setups:
    // - reads tach RPM
    // - maps RPM/pressure to flow
    // - injects available flow into the pressure controller
    DimmedPump(uint8_t ssr_pin, uint8_t sense_pin, uint8_t rpm_pin, PressureSensor *pressureSensor, uint8_t sclPin,
               uint8_t sdaPin);

    ~DimmedPump() = default;

    void setup() override;
    void loop() override;
    void setPower(float setpoint) override;

    float getCoffeeVolume();
    float getPumpFlow();
    float getPuckFlow();
    float getPuckResistance();

    void tare();

    void setFlowTarget(float targetFlow, float pressureLimit);
    void setPressureTarget(float targetPressure, float flowLimit);
    void setPumpFlowCoeff(float oneBarFlow, float nineBarFlow);
    void setPumpFlowPolyCoeffs(float a, float b, float c, float d);

    void stop();
    void fullPower();
    void setValveState(bool open);

  private:
    // Hardware pins and peripherals.
    uint8_t _ssr_pin;
    uint8_t _sense_pin;
    uint8_t _rpm_pin;

    PSM _psm;
    PressureSensor *_pressureSensor;

    SoftWire *i2c;
    MCP4725 *mcp;

    // Control setpoints and valve state.
    ControlMode _mode = ControlMode::POWER;

    float _power = 0.0f;
    float _controllerPower = 0.0f;

    float _ctrlPressure = 0.0f;
    float _ctrlFlow = 0.0f;

    int _valveStatus = 0;

    // Runtime measurements and derived flow estimate.
    float _currentPressure = 0.0f;
    float _currentFlow = 0.0f;
    float _estimatedFlow = 0.0f;
    float _availableFlow = 0.0f;

    // RPM sampling and controller integration.
    RpmSensor _rpmSensor;

    PressureController _pressureController;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);

    // Helpers/constants for pump loop.
    void updatePower();

    static constexpr float MCP_VOLTAGE = 5.0f;
    static constexpr float LOOP_DT = 0.03f;
    static constexpr float PRESSURE_MIN_FOR_EST = 0.5f;
    static constexpr float FLOW_FILTER_ALPHA = 0.2f;

    const char *LOG_TAG = "DimmedPump";
};

#endif // DIMMEDPUMP_H
