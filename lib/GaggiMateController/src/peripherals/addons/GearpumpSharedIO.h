#pragma once
#include <Wire.h>
#include <peripherals/SharedI2CBus.h>

// XL9555 port 0 drives the DAC's local, bit-banged bus (IO0=SCL, IO1=SDA).
// Cache the output/config registers so each edge needs at most one I2C write.
// Other devices may use the main bus between edges; only this task owns IO0/1.
class GearpumpSharedIO {
  public:
    GearpumpSharedIO(TwoWire &wire, uint8_t address, SemaphoreHandle_t mutex) : wire(wire), address(address), mutex(mutex) {}
    bool prepare();
    uint8_t readPin(uint8_t pin);
    void setPin(uint8_t pin, bool high);
    bool failed() const { return fault; }
    bool released(uint8_t pin) const { return config & (1u << pin); } // driven state, no bus traffic
    // Sends a whole I2C write frame to the DAC bus in few expander transactions; ACKs are not checked.
    bool burstWrite(uint8_t address, const uint8_t *data, size_t length);

  private:
    bool readRegister(uint8_t reg, uint8_t &value);
    bool writeRegister(uint8_t reg, uint8_t value);
    TwoWire &wire;
    uint8_t address;
    SemaphoreHandle_t mutex;
    uint8_t config = 0xFF;
    uint8_t config1 = 0xFF; // port 1 direction, rewritten unchanged between port 0 edges in a burst
    uint8_t output = 0;
    bool fault = false;
};
