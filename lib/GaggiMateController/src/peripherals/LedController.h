#ifndef LEDCONTROLLER_H
#define LEDCONTROLLER_H

#include <Arduino.h>
#include <PCA9634.h>
#include <Wire.h>

class LedController {
  public:
    LedController(TwoWire *i2c);
    void setup();
    bool isAvailable();
    void setChannel(uint8_t channel, uint8_t brightness);
    void disable();

  private:
    bool initialize();

    PCA9634 *pca9634 = nullptr;
    bool initialized = false;
};

#endif // LEDCONTROLLER_H
