#ifndef GEARPUMPADDON_H
#define GEARPUMPADDON_H

#include "MCP4725.h"
#include <Arduino.h>
#include <SoftWire.h>
#include <Wire.h>
#include <array>
#include <freertos/semphr.h>

// Drives the addon's MCP4725 through bit-banged I2C on XL9555 pins; the XL9555 bus is shared with the ADC on Max boards.
class GearpumpAddon {
  public:
    GearpumpAddon(uint8_t addr, uint8_t sda, uint8_t scl, uint8_t interrupt, TwoWire &bus, bool sharedWithAdc);
    void setup(float *power);
    SemaphoreHandle_t sharedBusMutex() const { return _busMutex; }
    void loop();
    void setMaxPower(float maxPower);

  private:
    TwoWire &_bus;
    bool _sharedWithAdc;
    SemaphoreHandle_t _busMutex = nullptr;
    uint32_t _lastRetry = 0;
    bool _fault = false;
    bool _ready = false; // DAC initialized; the task retries until it is
    uint16_t _lastDacValue = UINT16_MAX;
    uint32_t _lastVerify = 0;
    uint8_t _verifyFailures = 0;
    bool verifyDac(uint16_t expected);
    bool setupDac();
    bool readDac(uint8_t *state);
    bool writeDac(const uint8_t *bytes, size_t size);
    uint8_t _addr;
    uint8_t _sda;
    uint8_t _scl;
    uint8_t _interrupt;

    float *_power = nullptr;
    float _maxPower = 1.0f;
    std::array<char, 128> swTxBuffer{};
    std::array<char, 128> swRxBuffer{};
    SoftWire *i2c = nullptr;

    const char *LOG_TAG = "GearpumpAddon";
    static void loopTask(void *arg);
    xTaskHandle taskHandle = nullptr;
};

#endif // GEARPUMPADDON_H
