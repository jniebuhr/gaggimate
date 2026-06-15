#ifndef BATTERYMONITOR_H
#define BATTERYMONITOR_H

#include <cstdint>

#include "constants.h"

// [display-battery] Display-only single-cell (3.7V) Li-ion telemetry. Pure logic
// (no hardware) so it also builds in the simulator. Feed it sampled millivolts; it
// stores the latest reading and maps it to an APPROXIMATE percentage via a coarse
// piecewise lookup table. The percentage is intentionally approximate — the UI also
// shows the raw voltage. This value is NEVER used for any controller/coffee decision.
//
// Caveat (documented in the UI/docs): when USB is plugged in, the measured voltage
// can reflect the charging voltage rather than the true remaining battery charge.
class BatteryMonitor {
  public:
    void update(uint16_t voltageMv, uint32_t now) {
        voltageMv_ = voltageMv;
        valid_ = voltageMv_ > 0;
        percent_ = valid_ ? percentFromMv(voltageMv_) : 0;
        lastSampleAt_ = now;
    }

    bool isValid() const { return valid_; }
    uint16_t voltageMv() const { return voltageMv_; }
    uint8_t percent() const { return percent_; }
    uint32_t lastSampleAt() const { return lastSampleAt_; }
    bool isLow() const { return valid_ && voltageMv_ < BATTERY_LOW_MV; }
    bool isCritical() const { return valid_ && voltageMv_ < BATTERY_CRITICAL_MV; }

    // Coarse Li-ion approximation with linear interpolation between table points.
    static uint8_t percentFromMv(uint16_t mv) {
        struct Point {
            uint16_t mv;
            uint8_t pct;
        };
        // Descending by voltage.
        static const Point lut[] = {
            {4200, 100}, {4100, 90}, {4000, 80}, {3900, 65}, {3800, 50}, {3700, 30}, {3600, 15}, {3500, 5}, {3400, 0},
        };
        const int n = sizeof(lut) / sizeof(lut[0]);
        if (mv >= lut[0].mv)
            return 100;
        if (mv <= lut[n - 1].mv)
            return 0;
        for (int i = 0; i < n - 1; i++) {
            if (mv <= lut[i].mv && mv > lut[i + 1].mv) {
                const uint16_t hiMv = lut[i].mv, loMv = lut[i + 1].mv;
                const uint8_t hiPct = lut[i].pct, loPct = lut[i + 1].pct;
                return loPct + (uint32_t)(mv - loMv) * (hiPct - loPct) / (hiMv - loMv);
            }
        }
        return 0;
    }

  private:
    bool valid_ = false;
    uint16_t voltageMv_ = 0;
    uint8_t percent_ = 0;
    uint32_t lastSampleAt_ = 0;
};

#endif // BATTERYMONITOR_H
