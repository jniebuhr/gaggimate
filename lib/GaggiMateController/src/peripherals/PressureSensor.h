#ifndef PRESSURESENSOR_H
#define PRESSURESENSOR_H

#include "ADSAdc.h"
#include "SimpleKalmanFilter/SimpleKalmanFilter.h"
#include <Arduino.h>

constexpr int PRESSURE_READ_INTERVAL_MS = 30;
constexpr float PRESSURE_KF_SAMPLE_TIME_S = PRESSURE_READ_INTERVAL_MS / 1000.0f;
constexpr float PRESSURE_KF_MEASUREMENT_NOISE = 0.1f; // R
constexpr float PRESSURE_KF_ESTIMATE_ERROR = 10.0f;   // initial P, converges on first sample
constexpr float PRESSURE_KF_PROCESS_NOISE =
    (4.0f * PRESSURE_KF_SAMPLE_TIME_S) * (4.0f * PRESSURE_KF_SAMPLE_TIME_S); // Q, same model as PressureController
constexpr int SENSOR_READ_INTERVAL_MS = 100;

class PressureSensor {
  public:
    PressureSensor(ADSAdc *adc, float pressure_scale = 16.0f, float voltage_floor = 0.5, float voltage_ceil = 4.5,
                   uint8_t channel = 0);
    ~PressureSensor() = default;

    void setup();
    void onReading(int reading);
    float getPressure() const { return _pressure; };
    float getRawPressure() const { return _raw_pressure; };
    void setScale(float pressure_scale);

  private:
    float _pressure = 0.0f;
    float _raw_pressure = 0.0f;
    float _pressure_adc_range;
    float _pressure_scale;
    float _pressure_step;
    int16_t _adc_floor;
    ADSAdc *_adc = nullptr;
    uint8_t _channel;
    SimpleKalmanFilter _filter;
};

#endif // PRESSURESENSOR_H
