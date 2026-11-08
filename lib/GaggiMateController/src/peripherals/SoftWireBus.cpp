#include "SoftWireBus.h"

static constexpr uint32_t CLEAR_HALF_PERIOD_US = 50;

SoftWireBus::SoftWireBus(SoftWire *wire) : _wire(wire), _mutex(xSemaphoreCreateRecursiveMutex()) {}

bool SoftWireBus::lock(uint32_t timeoutMs) { return xSemaphoreTakeRecursive(_mutex, pdMS_TO_TICKS(timeoutMs)) == pdTRUE; }

void SoftWireBus::unlock() { xSemaphoreGiveRecursive(_mutex); }

bool SoftWireBus::clear() {
    // I2C bus clear: 9 clocks with SDA released flush a slave stuck mid-byte, STOP resets its state machine.
    SoftWire::sdaHigh(_wire);
    for (int i = 0; i < 9; i++) {
        SoftWire::sclLow(_wire);
        delayMicroseconds(CLEAR_HALF_PERIOD_US);
        SoftWire::sclHigh(_wire);
        delayMicroseconds(CLEAR_HALF_PERIOD_US);
    }
    _wire->stop(false);
    delayMicroseconds(CLEAR_HALF_PERIOD_US);
    bool idle = SoftWire::readSda(_wire) && SoftWire::readScl(_wire);
    if (!idle) {
        ESP_LOGE("SoftWireBus", "Bus still held after clear (SDA=%d SCL=%d)", SoftWire::readSda(_wire), SoftWire::readScl(_wire));
    }
    return idle;
}
