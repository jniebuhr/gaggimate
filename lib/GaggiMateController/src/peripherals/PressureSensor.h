#ifndef PRESSURESENSOR_H
#define PRESSURESENSOR_H

#include "ADSAdc.h"
#include "TwoStateKalmanFilter/TwoStateKalmanFilter.h"
#include <Arduino.h>
#include "PressureTiming.h"

// The telemetry filter consumes one pressure average per control interval.
constexpr float PRESSURE_KF_MEASUREMENT_NOISE = 0.01f; // R, (0.1 bar)^2 incl. pump ripple
constexpr float PRESSURE_KF_ACCEL_NOISE = 0.5f;        // Q scale; raise to track faster, lower to smooth more
constexpr float PRESSURE_KF_RATE_LEAK = 0.95f;         // damps overshoot and low-frequency wave amplification
constexpr int SENSOR_READ_INTERVAL_MS = 100;

class PressureSensor {
  public:
    PressureSensor(ADSAdc *adc, PressureControlRate controlRate, float pressure_scale = 16.0f,
                   float voltage_floor = 0.5, float voltage_ceil = 4.5, uint8_t channel = 0);
    ~PressureSensor() = default;

    void setup();
    void onReading(int reading);
    bool consumeAverage();
    float getAveragedPressure() const { return _averagedPressure; }
    float getSampleTime() const { return _sampleTime; }
    float getPressure() const { return _pressure; };
    float getRawPressure() const { return _raw_pressure; };
    void setScale(float pressure_scale);

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
    ADSAdc *_adc = nullptr;
    uint8_t _channel;
    TwoStateKalmanFilter _filter;
};

#endif // PRESSURESENSOR_H
