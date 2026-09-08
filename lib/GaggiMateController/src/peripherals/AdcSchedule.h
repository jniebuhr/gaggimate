#pragma once

#include <cstdint>

// Absolute release times permit normal multiplexing jitter without losing
// samples. Resynchronize after a stall instead of replaying old work.
class AdcSchedule {
  public:
    void configure(uint8_t channel, uint32_t periodUs, int64_t firstUs) {
        periods[channel] = periodUs;
        due[channel] = firstUs;
    }
    uint8_t next() const {
        uint8_t selected = 0;
        bool found = false;
        for (uint8_t ch = 0; ch < 4; ++ch) {
            if (periods[ch] && (!found || due[ch] < due[selected])) {
                selected = ch;
                found = true;
            }
        }
        return selected;
    }
    int64_t deadline(uint8_t channel) const { return due[channel]; }
    bool advance(uint8_t channel, int64_t now) {
        const bool stalled = now - due[channel] >= 10000;
        if (stalled) due[channel] = now;
        due[channel] += periods[channel];
        return stalled;
    }
  private:
    uint32_t periods[4] = {};
    int64_t due[4] = {};
};
