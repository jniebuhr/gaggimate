#ifndef RPM_SENSOR_H
#define RPM_SENSOR_H

#include <Arduino.h>

class RpmSensor {
  public:
    // Capture tach pulses and compute filtered RPM.
    explicit RpmSensor(uint8_t pin, uint8_t pulsesPerRevolution = 2);

    void setup();
    void update();
    float getRPM() const { return _rpm; }

  private:
    static void IRAM_ATTR isrHandler(void *arg);

    uint8_t _pin;
    uint8_t _pulsesPerRevolution;
    volatile uint32_t _lastPulseMicros = 0;
    volatile uint32_t _pulseInterval = 0;
    float _rpm = 0.0f;

    static constexpr uint32_t RPM_TIMEOUT_US = 200000;
};

#endif
