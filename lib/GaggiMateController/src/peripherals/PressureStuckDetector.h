#ifndef PRESSURESTUCKDETECTOR_H
#define PRESSURESTUCKDETECTOR_H

#include <atomic>
#include <cstdint>

// An unplugged signal or ground wire leaves the pressure input at a steady in-range voltage, so check that the reading
// responds to the pump. Measured on a flush without portafilter: a live sensor's mean moved by >= 0.055 V, a
// disconnected input's by <= 0.001 V.
constexpr float PRESSURE_STUCK_MIN_SWING_V = 0.015f;
constexpr float PRESSURE_STUCK_PUMP_POWER = 80.0f; // only judge runs where the pump surely moves water
constexpr uint32_t PRESSURE_STUCK_MIN_RUN_MS = 3000;
constexpr uint16_t PRESSURE_STUCK_BLOCK_SAMPLES = 25; // control-cycle averages per mean (~0.5 s), smooths ADC noise

// Flags a pressure input whose voltage stays flat while the pump runs; clears once a later run shows movement.
class PressureStuckDetector {
  public:
    // Called every control cycle with the applied pump power and the latest averaged input voltage.
    void update(float pumpPower, bool fresh, float voltage);
    bool isStuck() const { return _stuck; }

  private:
    bool _pumpRunning = false;
    uint32_t _pumpRunStartMs = 0;
    float _blockSum = 0.0f;
    uint16_t _blockCount = 0;
    uint16_t _blocks = 0;
    float _swingMin = 0.0f;
    float _swingMax = 0.0f;
    std::atomic<bool> _stuck{false};

    const char *LOG_TAG = "PressureSensor";
};

#endif // PRESSURESTUCKDETECTOR_H
