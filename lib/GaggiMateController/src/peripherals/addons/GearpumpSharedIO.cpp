#include "GearpumpSharedIO.h"

bool GearpumpSharedIO::readRegister(uint8_t reg, uint8_t &value) {
    if (fault)
        return false;
    SharedI2CBusGuard guard(mutex);
    wire.beginTransmission(address);
    wire.write(reg);
    if (wire.endTransmission(false) != 0 || wire.requestFrom(address, uint8_t(1)) != 1) {
        fault = true;
        return false;
    }
    value = wire.read();
    return true;
}

bool GearpumpSharedIO::writeRegister(uint8_t reg, uint8_t value) {
    if (fault)
        return false;
    SharedI2CBusGuard guard(mutex);
    wire.beginTransmission(address);
    wire.write(reg);
    wire.write(value);
    fault = wire.endTransmission() != 0;
    return !fault;
}

bool GearpumpSharedIO::prepare() {
    fault = false;
    if (!readRegister(0x06, config) || !readRegister(0x02, output))
        return false;
    // Keep both output latches low and use direction bits for open-drain edges.
    // Preserve all other XL9555 pins and release both local bus lines.
    output &= ~uint8_t(3);
    config |= 3;
    return writeRegister(0x02, output) && writeRegister(0x06, config);
}

uint8_t GearpumpSharedIO::readPin(uint8_t pin) {
    uint8_t value;
    // A failed expander read must look like NACK, never a successful DAC ACK.
    return readRegister(0x00, value) ? !!(value & (1u << pin)) : HIGH;
}

void GearpumpSharedIO::setPin(uint8_t pin, bool high) {
    uint8_t next = high ? config | (1u << pin) : config & ~(1u << pin);
    if (next != config && writeRegister(0x06, next))
        config = next;
}
