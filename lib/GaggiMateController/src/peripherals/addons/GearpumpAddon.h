#ifndef GEARPUMPADDON_H
#define GEARPUMPADDON_H

#include "MCP4725.h"
#include <Arduino.h>
#include <SoftWire.h>

class GearpumpAddon {
  public:
    GearpumpAddon(uint8_t addr, uint8_t sda, uint8_t scl, uint8_t interrupt);
    void setup(float *power);
    void loop();
    void stop();
    void setMaxPower(float maxPower);

  private:
    uint8_t _addr;
    uint8_t _sda;
    uint8_t _scl;
    uint8_t _interrupt;

    float *_power = nullptr;
    float _currentPower = 0.0f;
    float _maxPower = 1.0f;
    SoftWire *i2c;
    MCP4725 *mcp;

    const char *LOG_TAG = "GearpumpAddon";
    static void loopTask(void *arg);
    xTaskHandle taskHandle;
};

#endif // GEARPUMPADDON_H
