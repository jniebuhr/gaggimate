#ifndef SIMPLEPUMP_H
#define SIMPLEPUMP_H

#include "Pump.h"
#include <Arduino.h>

constexpr int PUMP_CYCLE_TIME = 5000;

class SimplePump : public Pump {
  public:
    SimplePump(int pin, uint8_t pumpOn);
    ~SimplePump() = default;

    void setup() override;
    void loop() override;
    void setPower(float setpoint) override;

  private:
    int _pin;
    uint8_t _pumpOn;
    float _setpoint = 0;
    unsigned long lastCycleStart = 0;
    xTaskHandle taskHandle;

    const char *LOG_TAG = "SimplePump";
    static void loopTask(void *arg);
};

#endif // SIMPLEPUMP_H
