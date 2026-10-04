#pragma once
#include <cstdint>

// Sole output arbiter. write(channel, state) returns the actual commanded state;
// clock() is sampled AFTER an off write completes (including expander latency).
class HeaterInterlock {
  public:
    void setDelay(uint32_t ms) { delayMs = ms; }
    bool isOn(unsigned channel) const { return on[channel]; }

    template<class Writer, class Clock>
    void update(bool brew, bool steam, bool priority, Writer write, Clock clock) {
        const bool wanted[2] = {brew, steam && (!priority || !brew)};
        for (unsigned ch = 0; ch < 2; ++ch) {
            if (on[ch] && !wanted[ch]) {
                on[ch] = write(ch, false);
                if (!on[ch]) offAt[ch] = clock();
            }
        }
        for (unsigned ch = 0; ch < 2; ++ch) {
            const unsigned other = 1 - ch;
            if (on[ch] && wanted[ch]) {
                on[ch] = write(ch, true);
                if (!on[ch]) offAt[ch] = clock();
            }
            if (wanted[ch] && !on[ch] &&
                (!priority || (!on[other] && uint32_t(clock() - offAt[other]) >= delayMs))) {
                on[ch] = write(ch, true);
            }
        }
    }

  private:
    bool on[2] = {};
    uint32_t offAt[2] = {};
    uint32_t delayMs = 50;
};
