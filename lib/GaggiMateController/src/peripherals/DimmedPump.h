#ifndef DIMMEDPUMP_H
#define DIMMEDPUMP_H
#include "PSM.h"
#include "Pump.h"
#include <Arduino.h>

class DimmedPump : public Pump {
  public:
    DimmedPump(uint8_t ssr_pin, uint8_t sense_pin);
    ~DimmedPump() = default;

    void setup() override;
    void loop() override;
    void setPower(float setpoint) override;

  private:
    uint8_t _ssr_pin;
    uint8_t _sense_pin;
    float _power = 0.0f;
    PSM _psm;
    xTaskHandle taskHandle;

    const char *LOG_TAG = "DimmedPump";
    static void loopTask(void *arg);
};

#endif // DIMMEDPUMP_H
