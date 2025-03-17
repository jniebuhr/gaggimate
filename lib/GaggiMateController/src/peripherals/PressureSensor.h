#ifndef PRESSURESENSOR_H
#define PRESSURESENSOR_H

#include <ADS1X15.h>
#include <Arduino.h>

constexpr int PRESSURE_READ_INTERVAL_MS = 500;
constexpr float ADC_STEP = 6.144f / 32767.0f;

using pressure_callback_t = std::function<void(float)>;

class PressureSensor {
  public:
    PressureSensor(uint8_t sda_pin, uint8_t scl_pin, const pressure_callback_t &callback, float pressure_range = 20.6843f,
                   float voltage_floor = 0.5, float voltage_ceil = 4.5);
    ~PressureSensor() = default;

    void setup();
    void loop();

  private:
    uint8_t _sda_pin;
    uint8_t _scl_pin;
    float _pressure_range;
    float _pressure_step;
    int16_t _adc_floor;
    ADS1115 *ads = nullptr;
    pressure_callback_t _callback;
    xTaskHandle taskHandle;

    const char *LOG_TAG = "PressureSensor";
    static void loopTask(void *arg);
};

#endif // PRESSURESENSOR_H
