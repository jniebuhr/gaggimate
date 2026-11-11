#include "GearpumpSharedIO.h"
#include <algorithm>

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
    if (!readRegister(0x06, config) || !readRegister(0x07, config1) || !readRegister(0x02, output))
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

bool GearpumpSharedIO::burstWrite(uint8_t address, const uint8_t *data, size_t length) {
    // The register pointer alternates within the 0x06/0x07 pair, so each port 0 edge is followed by port 1's value.
    uint8_t edges[96];
    size_t count = 0;
    const uint8_t base = config & ~uint8_t(3);
    auto push = [&](bool scl, bool sda) {
        const uint8_t v = base | (scl ? 1 : 0) | (sda ? 2 : 0);
        if ((count == 0 ? config : edges[count - 1]) != v && count < sizeof(edges))
            edges[count++] = v;
    };
    push(true, true);
    push(true, false); // START
    push(false, false);
    for (size_t i = 0; i <= length; ++i) {
        const uint8_t byte = i == 0 ? uint8_t(address << 1) : data[i - 1];
        for (int bit = 7; bit >= 0; --bit) {
            const bool d = (byte >> bit) & 1;
            push(false, d);
            push(true, d);
            push(false, d);
        }
        push(false, true); // release SDA for the ACK clock
        push(true, true);
        push(false, true);
    }
    push(false, false); // STOP
    push(true, false);
    push(true, true);
    if (count == sizeof(edges))
        return false;
    constexpr size_t EDGES_PER_CHUNK = 63; // register byte + 63 edge/filler pairs fit the 128-byte Wire buffer
    for (size_t start = 0; start < count && !fault; start += EDGES_PER_CHUNK) {
        const size_t end = std::min(count, start + EDGES_PER_CHUNK);
        SharedI2CBusGuard guard(mutex);
        wire.beginTransmission(this->address);
        wire.write(0x06);
        for (size_t i = start; i < end; ++i) {
            wire.write(edges[i]);
            if (i + 1 < end)
                wire.write(config1);
        }
        fault = wire.endTransmission() != 0;
    }
    if (!fault)
        config = edges[count - 1];
    return !fault;
}
