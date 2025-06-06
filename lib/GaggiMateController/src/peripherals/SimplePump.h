#ifndef SIMPLEPUMP_H
#define SIMPLEPUMP_H

#include "Pump.h"
#include <Arduino.h>

class SimplePump : public Pump {
  public:
    SimplePump(int pin, uint8_t pumpOn, float windowSize = 5000.0f);
    ~SimplePump() = default;

    void setup() override;
    void loop() override;
    void setPower(float setpoint) override;

  private:
    int _pin;
    uint8_t _pumpOn;
    float _setpoint = 0;
    bool relayStatus = false;
    float _windowSize = 5000.0f;
    unsigned long windowStartTime = 0;
    unsigned long nextSwitchTime = 0;
    xTaskHandle taskHandle;

    const char *LOG_TAG = "SimplePump";
    static void loopTask(void *arg);
};

#endif // SIMPLEPUMP_H
