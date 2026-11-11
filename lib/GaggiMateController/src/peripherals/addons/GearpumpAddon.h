#ifndef GEARPUMPADDON_H
#define GEARPUMPADDON_H

#include "MCP4725.h"
#include <Arduino.h>
#include <SoftWire.h>
#include <Wire.h>
#include <freertos/semphr.h>

class GearpumpAddon {
  public:
    GearpumpAddon(uint8_t addr, uint8_t sda, uint8_t scl, uint8_t interrupt, TwoWire *sharedBus = nullptr);
    void setup(float *power);
    SemaphoreHandle_t sharedBusMutex() const { return _sharedBusMutex; }
    void loop();
    void setMaxPower(float maxPower);

  private:
    TwoWire *_sharedBus;
    SemaphoreHandle_t _sharedBusMutex = nullptr;
    uint32_t _lastRetry = 0;
    bool _sharedFault = false;
    bool _sharedReady = false; // shared-bus DAC initialized; the task retries until it is
    uint16_t _lastDacValue = UINT16_MAX;
    bool setupSharedDac();
    bool readSharedDac(uint8_t *state);
    bool writeSharedDac(const uint8_t *bytes, size_t size);
    uint8_t _addr;
    uint8_t _sda;
    uint8_t _scl;
    uint8_t _interrupt;

    float *_power = nullptr;
    float _maxPower = 1.0f;
    SoftWire *i2c = nullptr;
    MCP4725 *mcp = nullptr;

    const char *LOG_TAG = "GearpumpAddon";
    void ensureSafePowerOnState();
    static void loopTask(void *arg);
    xTaskHandle taskHandle = nullptr;
};

#endif // GEARPUMPADDON_H
