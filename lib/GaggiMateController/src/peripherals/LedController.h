#ifndef LEDCONTROLLER_H
#define LEDCONTROLLER_H

#include "SoftWireBus.h"
#include <Arduino.h>
#include <PCA9634/PCA9634.h>

class LedController {
  public:
    LedController(SoftWireBus *bus);
    void setup();
    bool isAvailable();
    void setChannel(uint8_t channel, uint8_t brightness);
    void disable();
    // Detects a PCA9634 that lost its config and re-initialises it with the last commanded values.
    void healthCheck();

  private:
    static constexpr uint8_t CHANNEL_COUNT = 8;

    bool initialize();
    bool recover();

    SoftWireBus *bus;
    PCA9634 *pca9634 = nullptr;
    bool initialized = false;
    bool healthy = true;
    uint8_t channels[CHANNEL_COUNT] = {0, 0, 0, 0, 0xFF, 0xFF, 0, 0};
};

#endif // LEDCONTROLLER_H
