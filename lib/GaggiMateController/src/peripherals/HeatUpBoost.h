#ifndef HEATUPBOOST_H
#define HEATUPBOOST_H

#include <cstdint>

// Full power while the boiler is well below the setpoint: a warm-up, a switch to steam, steaming milk.
//
// With the heat-balance predictor on, the PID runs on measured + heat in flight. At full power that is ~12 °C on a Silvia
// (20 s x 1100 W / 1833 J/°C), and Kd brakes on the rise, so the heater fell to 10-20 % while the boiler was still
// 10-30 °C under (bench, 2026-10-30 morning: 6-7 min to warm up from 71 °C, steam heat-up held to ~20 %, steaming at
// ~70 %). Below BELOW_C of predicted shortfall nothing is close enough to overshoot from, so run flat out and let the
// PID take over near the setpoint. Not within AFTER_FLOW_MS of water flowing: after a flush the reading dips and
// rebounds by itself, and the predictor and PID already handle that (simulator: 5 °C reaches the setpoint in 80-170 s
// instead of 355-590 s; 2-3 °C overshoots by 2.5-4.75 °C). Only a flush or shot counts as water (over FLUSH_FLOW
// ml/s): steam pump assist trickles ~0.4 ml/s into the boiler while steaming, and blocked the boost all through the
// steam on the machine (2026-10-30, second brew). Steam setpoints are exempt too: a shot's dip right before steaming
// (the usual routine) is no reason to hold back a 30 °C climb.
struct HeatUpBoost {
    static constexpr float BELOW_C = 5.0f;
    static constexpr uint32_t AFTER_FLOW_MS = 120000;
    static constexpr float FLUSH_FLOW = 1.0f;         // ml/s: below this it's pump assist, not a flush or shot
    static constexpr float STEAM_SETPOINT_C = 110.0f; // from here up counts as steam

    // msSinceFlush: since flow last exceeded FLUSH_FLOW (flushSeen false: never).
    static bool active(bool predictorOn, float setpoint, float controlTemperature, bool flushSeen, uint32_t msSinceFlush) {
        if (!predictorOn || setpoint <= 0.0f)
            return false;
        if (setpoint < STEAM_SETPOINT_C && flushSeen && msSinceFlush < AFTER_FLOW_MS)
            return false;
        return setpoint - controlTemperature > BELOW_C;
    }
};

#endif // HEATUPBOOST_H
