// Simulated controller board: a small thermal + hydraulic model that reacts to
// the boiler/pump/relay commands the display sends and emits sensor telemetry.
#pragma once

#include "GaggiMateComm.h"
#include <cstdint>
#include <functional>

class MockController {
  public:
    using SensorFn = std::function<void(float temp, float pressure, float puckFlow, float pumpFlow, float puckResistance)>;
    using VolumetricFn = std::function<void(float volume)>;
    using TofFn = std::function<void(uint32_t distance)>;

    void begin();
    void update();

    void setBoiler(const BoilerCommand &c);
    void setPump(const PumpCommand &c);
    void setRelay(const RelayCommand &c);
    void tareScale() { weight = 0.0f; }

    SensorFn onSensor;
    VolumetricFn onVolumetric;
    TofFn onTof;

  private:
    bool active = false;
    uint32_t lastUpdateMs = 0;
    uint32_t lastSensorMs = 0;
    uint32_t lastTofMs = 0;

    float ambient = 21.0f;
    float temperature = 21.0f;
    float targetTemp = 0.0f; // boiler setpoint (0 = off)

    PumpControlMode pumpMode = PumpControlMode::Power;
    float pumpPower = 0.0f;      // 0..100
    float targetPressure = 0.0f; // bar
    float targetFlow = 0.0f;     // ml/s
    bool brewValveOpen = false;

    float pressure = 0.0f; // bar
    float flow = 0.0f;     // ml/s
    float weight = 0.0f;   // g accumulated on the scale
};
