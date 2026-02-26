#ifndef PRESSURESENSOR_H
#define PRESSURESENSOR_H

#include "ADSAdc.h"
#include <Arduino.h>

constexpr int SENSOR_READ_INTERVAL_MS = 100;

class PressureSensor {
  public:
    PressureSensor(ADSAdc *adc, float pressure_scale = 16.0f, float voltage_floor = 0.5, float voltage_ceil = 4.5,
                   uint8_t channel = 0);
    ~PressureSensor() = default;

    void setup();
    void loop();
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
    xTaskHandle taskHandle;

    const char *LOG_TAG = "PressureSensor";
    static void loopTask(void *arg);
};

#endif // PRESSURESENSOR_H
