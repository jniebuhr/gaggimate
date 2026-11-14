#ifndef PRESSURESENSOR_H
#define PRESSURESENSOR_H

#include "ADSAdc.h"
#include "PressureTiming.h"
#include "TwoStateKalmanFilter/TwoStateKalmanFilter.h"
#include <Arduino.h>
#include <atomic>

// The telemetry filter consumes one pressure average per control interval.
constexpr float PRESSURE_KF_MEASUREMENT_NOISE = 0.01f; // R, (0.1 bar)^2 incl. pump ripple
constexpr float PRESSURE_KF_ACCEL_NOISE = 0.5f;        // Q scale; raise to track faster, lower to smooth more
constexpr float PRESSURE_KF_RATE_LEAK = 0.95f;         // damps overshoot and low-frequency wave amplification
constexpr int SENSOR_READ_INTERVAL_MS = 100;
// A 0.5-4.5 V sensor never drives its output this close to the rails; such readings mean a lost supply or a short.
constexpr float PRESSURE_FAULT_VOLTAGE_LOW = 0.35f;
constexpr float PRESSURE_FAULT_VOLTAGE_HIGH = 4.75f;
constexpr uint32_t PRESSURE_FAULT_TIMEOUT_MS = 1000; // no valid sample for this long reports a fault
// An unplugged signal or ground wire leaves the input at a steady in-range voltage, so also check that the reading
// responds to the pump. Measured on a flush without portafilter: a live sensor's mean moved by >= 0.055 V, a
// disconnected input's by <= 0.001 V.
constexpr float PRESSURE_STUCK_MIN_SWING_V = 0.015f;
constexpr float PRESSURE_STUCK_PUMP_POWER = 80.0f; // only judge runs where the pump surely moves water
constexpr uint32_t PRESSURE_STUCK_MIN_RUN_MS = 3000;
constexpr uint16_t PRESSURE_STUCK_BLOCK_SAMPLES = 25; // control-cycle averages per mean (~0.5 s), smooths ADC noise

class PressureSensor {
  public:
    PressureSensor(ADSAdc *adc, PressureControlRate controlRate, float pressure_scale = 16.0f, float voltage_floor = 0.5,
                   float voltage_ceil = 4.5, uint8_t channel = 0);
    ~PressureSensor() = default;

    void setup();
    void onReading(int reading);
    bool consumeAverage();
    float getAveragedPressure() const { return _averagedPressure; }
    float getSampleTime() const { return _sampleTime; }
    float getPressure() const { return _pressure; };
    float getRawPressure() const { return _raw_pressure; };
    void setScale(float pressure_scale);
    bool isFaulty() const { return _stuck || millis() - _lastValidMs >= PRESSURE_FAULT_TIMEOUT_MS; }
    // Called every control cycle with the applied pump power; flags a reading that stays flat while the pump runs.
    void trackPumpRun(float pumpPower, bool fresh);

  private:
    float _pressure = 0.0f;
    float _averagedPressure = 0.0f;
    float _sampleTime;
    int64_t _lastWindowUs = 0;
    float _sum = 0.0f;
    uint32_t _count = 0;
    portMUX_TYPE _mux = portMUX_INITIALIZER_UNLOCKED;
    float _raw_pressure = 0.0f;
    float _pressure_adc_range;
    float _pressure_scale;
    float _pressure_step;
    int16_t _adc_floor;
    int16_t _adc_fault_low;
    int16_t _adc_fault_high;
    std::atomic<uint32_t> _lastValidMs{0};
    float _voltageSum = 0.0f;
    float _averagedVoltage = 0.0f;
    bool _pumpRunning = false;
    uint32_t _pumpRunStartMs = 0;
    float _blockSum = 0.0f;
    uint16_t _blockCount = 0;
    uint16_t _blocks = 0;
    float _swingMin = 0.0f;
    float _swingMax = 0.0f;
    std::atomic<bool> _stuck{false};
    ADSAdc *_adc = nullptr;
    uint8_t _channel;
    TwoStateKalmanFilter _filter;

    const char *LOG_TAG = "PressureSensor";
};

#endif // PRESSURESENSOR_H
