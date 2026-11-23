// Unit tests: HeatBalancePredictor, plus a closed-loop flush replay of a single-boiler machine with a
// laggy thermocouple (Rancilio Silvia class: 1100 W element, ~1.8 kJ/°C, ~20 s heater-to-sensor lag).
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_heat_balance_predictor.

#include <unity.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <deque>
#include <vector>

#include "peripherals/HeatUpBoost.h"

static uint32_t fakeNow = 0;
static uint32_t millis() { return fakeNow; }
#define constrain(x, lo, hi) ((x) < (lo) ? (lo) : ((x) > (hi) ? (hi) : (x)))
#define ESP_LOGV(...)
#ifndef PI
#define PI 3.14159265358979323846f
#endif

#include "SimplePID/SimplePID.cpp"
#include "peripherals/HeatBalancePredictor.cpp"

void setUp() { /* no shared fixture state */ }
void tearDown() { /* no shared fixture state */ }

// ---------------------------------------------------------------------------
// Predictor unit tests
// ---------------------------------------------------------------------------

void test_disabled_when_any_parameter_missing() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.0f, 20.0f);
    TEST_ASSERT_FALSE(p.isEnabled());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, p.update(1.0f, 1.0f, 0.0f, 93.0f, 98.0f));
    p.configure(1100.0f, 0.6f, -1.0f);
    TEST_ASSERT_FALSE(p.isEnabled());
    p.configure(NAN, 0.6f, 20.0f);
    TEST_ASSERT_FALSE(p.isEnabled());
}

// Full power for longer than the dead time: the correction is the rise the sensor hasn't shown yet,
// i.e. rate × dead time.
void test_full_power_correction_is_rate_times_dead_time() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    for (int i = 0; i < 60; ++i)
        p.update(1.0f, 1.0f, 0.0f, 60.0f, 98.0f); // far from setpoint: no loss learning
    TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.6f * 20.0f, p.getCorrection());
}

// Heat in flight drains out of the window once the heater stops.
void test_correction_decays_after_heater_off() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    for (int i = 0; i < 30; ++i)
        p.update(1.0f, 1.0f, 0.0f, 60.0f, 98.0f);
    for (int i = 0; i < 20; ++i)
        p.update(1.0f, 0.0f, 0.0f, 60.0f, 98.0f);
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, 0.0f, p.getCorrection());
}

// A gap in the updates (the predictor switched off in the settings for a while, then on again) is not heat: the bench
// on 2026-11-03 switched the lag compensation off for 13 min; the first step back counted 780 s of standing loss plus
// as a >15 °C shortfall, and the heat-up boost ran flat out at the setpoint for 20 s.
void test_long_gap_is_not_counted_as_heat() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    p.seedLoss(36.0f);
    p.update(780.0f, 0.03f, 0.0f, 98.0f, 98.0f);
    // one step of at most MAX_STEP_S: (33 - ~38) W x 5 s / 1833 J/°C, well under half a degree
    TEST_ASSERT_TRUE(p.getCorrection() > -0.5f);
}

// A flush is seen at once: 10 ml/s of 23 °C water into a 98 °C boiler removes ~3.1 kW.
void test_flush_gives_immediate_negative_correction() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    for (int i = 0; i < 5; ++i)
        p.update(1.0f, 0.0f, 10.0f, 98.0f, 98.0f);
    const float capacity = 1100.0f / 0.6f;
    const float expected = -5.0f * 10.0f * 4.18f * (98.0f - 23.0f) / capacity;
    TEST_ASSERT_FLOAT_WITHIN(0.05f, expected, p.getCorrection());
}

// A delay that isn't a whole number of steps counts the straddling step in part: 2.5 s of full power over 1 s steps is
// half way between 2 s and 3 s, not the same as 3 s.
void test_partial_step_inside_delay_counts_in_part() {
    const auto correctionAfter = [](float deadTime) {
        HeatBalancePredictor p;
        p.configure(1100.0f, 0.6f, deadTime, 23.0f);
        for (int i = 0; i < 10; ++i)
            p.update(1.0f, 1.0f, 0.0f, 50.0f, 98.0f); // full power, far from setpoint (no loss learning)
        return p.getCorrection();
    };
    const float c2 = correctionAfter(2.0f);
    const float c3 = correctionAfter(3.0f);
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, (c2 + c3) / 2.0f, correctionAfter(2.5f));
}

// With its own, shorter delay a flush stops counting once the sensor has seen it (5 s), instead of after the heater's
// dead time (20 s), so it isn't counted twice.
void test_water_delay_drains_flush_sooner() {
    HeatBalancePredictor shared;
    HeatBalancePredictor separate;
    shared.configure(1100.0f, 0.6f, 20.0f, 23.0f);
    separate.configure(1100.0f, 0.6f, 20.0f, 23.0f, 5.0f);
    TEST_ASSERT_EQUAL_FLOAT(20.0f, shared.getWaterDeadTime());
    TEST_ASSERT_EQUAL_FLOAT(5.0f, separate.getWaterDeadTime());
    for (int i = 0; i < 5; ++i) { // 5 s flush, heater off
        shared.update(1.0f, 0.0f, 10.0f, 98.0f, 98.0f);
        separate.update(1.0f, 0.0f, 10.0f, 98.0f, 98.0f);
    }
    for (int i = 0; i < 10; ++i) {
        shared.update(1.0f, 0.0f, 0.0f, 90.0f, 98.0f);
        separate.update(1.0f, 0.0f, 0.0f, 90.0f, 98.0f);
    }
    TEST_ASSERT_TRUE(shared.getCorrection() < -3.0f); // still counting the flush 10 s after it ended
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, 0.0f, separate.getCorrection());
}

// Heater heat keeps the full dead time even when water has a shorter one.
void test_water_delay_leaves_heater_delay_alone() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f, 23.0f, 5.0f);
    for (int i = 0; i < 60; ++i)
        p.update(1.0f, 1.0f, 0.0f, 60.0f, 98.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.6f * 20.0f, p.getCorrection());
}

// Warmer tank water takes proportionally less heat per ml: a 40 °C tank (measured on a Silvia) removes
// (98 - 40) / (98 - 23) = 77 % of what the old fixed 23 °C assumption did.
void test_flush_correction_scales_with_inlet_temperature() {
    HeatBalancePredictor cold;
    HeatBalancePredictor warm;
    cold.configure(1100.0f, 0.6f, 20.0f, 23.0f);
    warm.configure(1100.0f, 0.6f, 20.0f, 40.0f);
    for (int i = 0; i < 5; ++i) {
        cold.update(1.0f, 0.0f, 10.0f, 98.0f, 98.0f);
        warm.update(1.0f, 0.0f, 10.0f, 98.0f, 98.0f);
    }
    TEST_ASSERT_FLOAT_WITHIN(0.01f, (98.0f - 40.0f) / (98.0f - 23.0f), warm.getCorrection() / cold.getCorrection());
}

// Holding temperature, the learned loss converges to the holding power, so the steady correction → 0 and the
// PID still settles the real sensor on setpoint.
void test_steady_state_correction_converges_to_zero() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    for (int i = 0; i < 3600; ++i)
        p.update(1.0f, 0.06f, 0.0f, 98.0f, 98.0f); // 66 W holding power
    TEST_ASSERT_FLOAT_WITHIN(1.0f, 66.0f, p.getLossWattsAt(98.0f));
    TEST_ASSERT_FLOAT_WITHIN(1.0f, 66.0f * 70.0f / 75.0f, p.getLossWatts()); // reported at 93 °C in a 23 °C room
    TEST_ASSERT_FLOAT_WITHIN(0.02f, 0.0f, p.getCorrection());
}

// Learned at brew temperature, the loss scales with the temperature above the room: holding at steam temperature
// the correction stays near zero straight away instead of reading the higher holding power as heat in flight.
void test_loss_learned_at_brew_holds_at_steam() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    for (int i = 0; i < 3600; ++i)
        p.update(1.0f, 0.06f, 0.0f, 98.0f, 98.0f);              // 66 W at 98 °C: 0.88 W/°C
    const float steamDuty = 0.88f * (140.0f - 23.0f) / 1100.0f; // 103 W at 140 °C
    for (int i = 0; i < 30; ++i)
        p.update(1.0f, steamDuty, 0.0f, 140.0f, 140.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.1f, 0.0f, p.getCorrection());
    TEST_ASSERT_FLOAT_WITHIN(2.0f, 103.0f, p.getLossWattsAt(140.0f));
}

void test_correction_is_bounded() {
    HeatBalancePredictor p;
    p.configure(3000.0f, 5.0f, 120.0f); // 600 °C of "in flight" heat if unbounded
    for (int i = 0; i < 200; ++i)
        p.update(1.0f, 1.0f, 0.0f, 60.0f, 98.0f);
    TEST_ASSERT_EQUAL_FLOAT(HeatBalancePredictor::MAX_CORRECTION, p.getCorrection());
}

// Re-sending settings (the display does this after every reconnect) must not drop the learned loss, and neither
// may a parameter change: the loss belongs to the boiler, not to the model parameters.
void test_identical_reconfigure_keeps_state() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    for (int i = 0; i < 600; ++i)
        p.update(1.0f, 0.06f, 0.0f, 98.0f, 98.0f);
    const float loss = p.getLossWatts();
    p.configure(1100.0f, 0.6f, 20.0f);
    TEST_ASSERT_EQUAL_FLOAT(loss, p.getLossWatts());
    p.configure(1100.0f, 0.5f, 20.0f);
    TEST_ASSERT_EQUAL_FLOAT(loss, p.getLossWatts());
}

// With nothing saved, the predictor starts from a default fraction of the heater instead of zero.
void test_first_seed_uses_default_fraction() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    p.seedLoss(0.0f);
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, HeatBalancePredictor::DEFAULT_LOSS_FRACTION * 1100.0f, p.getLossWatts());
}

// A saved value seeds the loss once; later seeds (every settings re-send carries the saved value) are ignored so
// they can't overwrite what has been learned since.
void test_saved_seed_applies_once() {
    HeatBalancePredictor p;
    p.configure(1100.0f, 0.6f, 20.0f);
    p.seedLoss(48.0f);
    TEST_ASSERT_EQUAL_FLOAT(48.0f, p.getLossWatts());
    for (int i = 0; i < 600; ++i)
        p.update(1.0f, 0.06f, 0.0f, 98.0f, 98.0f); // learns towards 66 W
    const float learned = p.getLossWatts();
    TEST_ASSERT_TRUE(learned > 55.0f);
    p.seedLoss(48.0f);
    TEST_ASSERT_EQUAL_FLOAT(learned, p.getLossWatts());
}

// Seeding waits for a valid model, and a saved value can't exceed the heater itself.
void test_seed_waits_for_enable_and_is_bounded() {
    HeatBalancePredictor p;
    p.seedLoss(48.0f);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, p.getLossWatts());
    p.configure(1100.0f, 0.6f, 20.0f);
    p.seedLoss(5000.0f);
    TEST_ASSERT_EQUAL_FLOAT(1100.0f, p.getLossWatts());
}

// ---------------------------------------------------------------------------
// Closed-loop flush replay
// ---------------------------------------------------------------------------
//
// Plant, fitted to a Rancilio Silvia (scripts/fit_plant.py over the 2026-10-29 bench logs, replaying the logged heater
// output and pump flow open loop): three thermal nodes. The element (200 J/°C) feeds the water (1296 J/°C) through
// 9.6 W/°C, so heater heat reaches the water with a ~21 s time constant and keeps arriving after the heater stops,
// which makes the real overshoot. The group head (819 J/°C) trades heat with the water through 5.7 W/°C (~2.4 min) and
// carries the standing loss (~45 W at 98 °C), so it sits ~8 °C below the water: after a flush it keeps
// pulling the water down, or soaking up the extra, for minutes. The thermocouple sees the water through a 4.6 s
// transport delay and a 15 s first-order lag (flush water shows after ~12 s, heater heat after ~40 s), then MAX31855
// quantisation (0.25 °C) and the driver's 0.2 EMA at 4 Hz. Each flush ends with the valve's ~5 g dump. Against bench flushes it
// doesn't see in fitting, it tracks the sensor to 0.45 °C rms (the earlier two-node plant: 1.09 °C) and puts the dip's low within
// ~6 s. Controller: SimplePID at 1 Hz on 0..1000 ms of a 1 s window, mirroring Heater::loopPid/updateLagCompensation. Scenario:
// settle at 98 °C (93 + 5 offset), then a 5 s, 8.9 ml/s flush of 35 °C tank water (as on the bench).

struct Tuning {
    float kp = 60.0f;
    float ki = 0.658f;
    float kd = 2800.0f;
    float derivFilterS = 0.0f;
    float integralZone = 0.0f;
    float modelW = 0.0f;
    float modelRate = 0.0f;
    float modelDeadS = 0.0f;
    float lossSeedW = 0.0f;       // as Heater: seedLoss(saved value, 0 = default guess); < 0 skips seeding (starts at 0)
    float waterDeadS = 0.0f;      // predictor's water delay, 0 = same as modelDeadS
    float predictorStartS = 0.0f; // switch the predictor on this long into the run, once the PID has settled
    // Tank temperature the flush water really cools like (plant) and the one the predictor is told. On the bench each ml
    // took ~20 % more heat than (boiler - tank setting) predicts: fitted sessions cool like 24-27 °C water at 35 °C.
    float plantInletC = 35.0f;
    float predictorInletC = 35.0f;
    // A shot instead of the 5 s flush: pump flow (ml/s) for each second from the start; and the setpoint (98 = a 93 °C
    // profile + 5 offset).
    std::vector<float> flowProfile;
    float setpointC = 98.0f;
    // Thermal feedforward as Heater::loopPid (settings kf, output units per watt; 1000 / 1100 W = the water's heat exactly).
    float kff = 0.0f;
    bool heatUpBoost = true; // as Heater::loopPid (HeatUpBoost.h)
};

struct Result {
    float dipMin;    // lowest sensor temperature after the flush
    float peak;      // highest sensor temperature after the dip
    float settleErr; // |mean error| over the last 2 minutes
    float idleP2P;   // sensor peak-to-peak while idling before the flush
    float idleSwing; // mean |change in output| per second while idling (heater chatter), output units
    float startSag;  // lowest (sensor - setpoint) in the 10 minutes after the predictor starts (predictorStartS > 0)
    float backAt;    // s after the flush starts until the sensor first climbs back to setpoint
    float waterLow;  // lowest boiler water temperature (not the sensor) from the flush/shot start to 2 min after
};

static constexpr float SILVIA_VALVE_DUMP_ML = 5.0f; // weighed on the bench, 2026-10-29

// Heater::calculateSafetyScaling without its smoothing: how much of the feedforward applies at this error.
static float feedforwardSafety(float err) {
    if (err > 1.0f)
        return 0.0f;
    if (err >= 0.0f)
        return 0.7f + 0.3f * (1.0f - err);
    if (err > -1.0f)
        return 0.7f - 0.3f * err;
    return 1.0f;
}

static Result simulate(const Tuning &tu) {
    const float dt = 0.25f;
    const float setpoint = tu.setpointC;
    const float room = 22.0f;
    const float lossPerK = 0.59f; // ~45 W at 98 °C
    const float plantW = 1100.0f;
    const float wallC = 200.0f;
    const float waterC = 1296.0f;
    const float wallToWater = 9.6f;
    const float groupC = 819.0f;
    const float waterToGroup = 5.7f;
    const float inletC = tu.plantInletC;
    const float flushFlow = 8.9f;
    const float delayS = 4.6f;
    const float lagS = 15.0f;
    const auto delaySteps = static_cast<int>(delayS / dt);

    const float holdW = lossPerK * (setpoint - room);
    float boiler = setpoint;
    float wall = setpoint + holdW / wallToWater;   // carrying the holding power
    float group = setpoint - holdW / waterToGroup; // the standing loss leaves through the group
    std::deque<float> pipe(delaySteps, boiler);
    float lagged = boiler;
    float ema = boiler;

    float output = 0.0f;
    float control = boiler;
    float measured = boiler;
    float sp = setpoint;
    SimplePID pid(&output, &control, &sp);
    pid.setDerivativeInput(&measured); // as Heater: D on the sensor, P/I on the prediction
    pid.setSamplingFrequency(1.0f);
    pid.setCtrlOutputLimits(0.0f, 1000.0f);
    pid.activateSetPointFilter(false);
    pid.setControllerPIDGains(tu.kp, tu.ki, tu.kd, 0.0f);
    pid.setDerivativeFilterTime(tu.derivFilterS);
    pid.setIntegralZone(tu.integralZone);
    pid.reset();
    pid.setMode(SimplePID::Control::automatic);

    HeatBalancePredictor predictor;
    bool predictorStarted = false;
    const auto startPredictor = [&] {
        predictor.configure(tu.modelW, tu.modelRate, tu.modelDeadS, tu.predictorInletC, tu.waterDeadS);
        predictor.setValveDump(SILVIA_VALVE_DUMP_ML);
        if (tu.lossSeedW >= 0.0f)
            predictor.seedLoss(tu.lossSeedW);
        predictorStarted = true;
    };
    if (tu.predictorStartS <= 0.0f)
        startPredictor();
    const uint32_t holdTailMs = tu.modelDeadS > 0.0f ? static_cast<uint32_t>(tu.modelDeadS * 1000.0f) : 0;
    uint32_t lastFlowMs = 0;
    bool flowSeen = false;
    uint32_t lastFlushMs = 0; // flow over HeatUpBoost::FLUSH_FLOW, as Heater::recordFlow tracks it for the boost
    bool flushSeen = false;

    const float flushStart = 1800.0f;
    const float end = flushStart + 600.0f;
    const float flushEnd = flushStart + (tu.flowProfile.empty() ? 5.0f : static_cast<float>(tu.flowProfile.size()));
    Result r{1e9f, -1e9f, 0.0f, 0.0f, 0.0f, 0.0f, -1.0f, 1e9f};
    float swingSum = 0.0f;
    float lastOutput = 0.0f;
    int swingN = 0;
    float idleMin = 1e9f;
    float idleMax = -1e9f;
    float errSum = 0.0f;
    int errN = 0;
    bool dipped = false;
    fakeNow = 1000;

    for (int step = 0; step * dt < end; ++step) {
        const float t = step * dt;
        float flow = 0.0f;
        if (t >= flushStart && t < flushEnd)
            flow = tu.flowProfile.empty() ? flushFlow : tu.flowProfile[static_cast<size_t>(t - flushStart)];

        // Controller, once per second (the PWM window); `output` was applied over the last second.
        if (step % 4 == 0) {
            fakeNow += 1000;
            measured = ema; // read() returns the driver's EMA of quantised samples
            if (flow > 0.0f) {
                lastFlowMs = fakeNow;
                flowSeen = true;
            }
            if (flow > HeatUpBoost::FLUSH_FLOW) {
                lastFlushMs = fakeNow;
                flushSeen = true;
            }
            if (tu.integralZone > 0.0f)
                pid.setIntegralHold(flow > 0.0f || (flowSeen && fakeNow - lastFlowMs < holdTailMs));
            if (!predictorStarted && t >= tu.predictorStartS)
                startPredictor();
            if (predictorStarted) {
                predictor.update(1.0f, output / 1000.0f, flow, measured, sp);
            }
            control = measured + predictor.getCorrection();
            if (tu.kff > 0.0f && flow > 0.01f) {
                // Heater::calculateDisturbanceFeedforwardGain + calculateSafetyScaling (without its smoothing)
                const float err = measured - sp;
                const float safety = feedforwardSafety(err);
                const float perFlow = (4.18f * (sp - tu.predictorInletC) + 5.0f / flow) / 0.95f;
                pid.setDisturbanceFeedforward(flow, perFlow * tu.kff * safety);
            } else {
                pid.setDisturbanceFeedforward(0.0f, 0.0f);
            }
            pid.update();
            if (tu.heatUpBoost &&
                HeatUpBoost::active(predictorStarted && predictor.isEnabled(), sp, control, flushSeen, fakeNow - lastFlushMs))
                output = 1000.0f;
            if (t > flushStart - 600.0f && t < flushStart) {
                swingSum += std::fabs(output - lastOutput);
                ++swingN;
            }
            lastOutput = output;

            if (tu.predictorStartS > 0.0f && t >= tu.predictorStartS && t < tu.predictorStartS + 600.0f)
                r.startSag = std::min(r.startSag, measured - setpoint);
            if (t > flushStart - 600.0f && t < flushStart) {
                idleMin = std::min(idleMin, measured);
                idleMax = std::max(idleMax, measured);
            }
            if (t >= flushStart) {
                if (!dipped) {
                    r.dipMin = std::min(r.dipMin, measured);
                    if (measured > r.dipMin + 0.5f)
                        dipped = true;
                } else {
                    r.peak = std::max(r.peak, measured);
                    if (r.backAt < 0.0f && measured >= setpoint)
                        r.backAt = t - flushStart;
                }
            }
            if (t > end - 120.0f) {
                errSum += measured - setpoint;
                ++errN;
            }
        }

        // Plant
        const float heat = plantW * output / 1000.0f;
        const float toWater = wallToWater * (wall - boiler);
        const float toGroup = waterToGroup * (boiler - group);
        const float water = flow * 4.18f * (boiler - inletC);
        wall += (heat - toWater) * dt / wallC;
        group += (toGroup - lossPerK * (boiler - room)) * dt / groupC;
        boiler += (toWater - water - toGroup) * dt / waterC;
        // As the flush ends the valve dumps the group's water (~5 g of boiler water) into the drip tray.
        if (t < flushEnd && t + dt >= flushEnd)
            boiler -= SILVIA_VALVE_DUMP_ML * 4.18f * (boiler - inletC) / waterC;
        if (t >= flushStart && t < flushStart + 120.0f)
            r.waterLow = std::min(r.waterLow, boiler);
        pipe.push_back(boiler);
        const float delayed = pipe.front();
        pipe.pop_front();
        lagged += (delayed - lagged) * dt / lagS;
        const float sample = std::floor(lagged * 4.0f) / 4.0f; // MAX31855 LSB
        ema = 0.2f * sample + 0.8f * ema;
    }
    r.settleErr = std::fabs(errSum / static_cast<float>(errN));
    r.idleP2P = idleMax - idleMin;
    r.idleSwing = swingSum / static_cast<float>(swingN);
    return r;
}

static void report(const char *name, const Result &r) {
    printf("%-34s dip %6.2f  peak %6.2f  overshoot %5.2f  back %5.0f s  settle err %4.2f  idle p2p %4.2f  idle swing %5.1f\n",
           name, r.dipMin, r.peak, r.peak - 98.0f, r.backAt, r.settleErr, r.idleP2P, r.idleSwing);
}

// The Silvia's settings (simon006 on): Kd 1500, D filter, integral zone, predictor with a 12 s water delay.
static Tuning compensated() {
    Tuning tu;
    tu.kd = 1500.0f;
    tu.waterDeadS = 12.0f;
    tu.derivFilterS = 2.0f;
    tu.integralZone = 1.5f;
    tu.modelW = 1100.0f;
    tu.modelRate = 0.6f;
    tu.modelDeadS = 20.0f;
    return tu;
}

// The legacy loop overshoots by ~3 °C after the flush whatever the gains; the full compensation removes most of it
// while still settling on setpoint and holding steady at idle.
void test_flush_overshoot_is_reduced() {
    const Result legacy = simulate(Tuning{});
    const Result comp = simulate(compensated());
    report("legacy 60/0.658/2800", legacy);
    report("compensated", comp);

    TEST_ASSERT_TRUE_MESSAGE(legacy.peak - 98.0f > 1.5f, "plant should reproduce a clear post-flush overshoot");
    TEST_ASSERT_TRUE(comp.peak - 98.0f < 0.5f * (legacy.peak - 98.0f));
    TEST_ASSERT_TRUE(comp.dipMin >= legacy.dipMin - 0.75f); // recovering without overshoot must not deepen the dip much
    TEST_ASSERT_TRUE(comp.settleErr < 0.3f);
    TEST_ASSERT_TRUE(comp.idleP2P <= 0.5f);
    TEST_ASSERT_TRUE(comp.idleSwing < 0.25f * legacy.idleSwing); // far less heater chatter at idle
}

// Each part on its own: the D filter cuts chatter, the predictor cuts the overshoot. On the fitted plant a 2 s filter
// alone delays the D term's braking enough to cost ~1 °C more overshoot (8 s: ~3 °C), which is why it ships with
// the predictor rather than on its own.
void test_individual_features() {
    const Result legacy = simulate(Tuning{});
    Tuning filt;
    filt.derivFilterS = 2.0f;
    Tuning zone;
    zone.integralZone = 1.5f;
    zone.modelDeadS = 20.0f; // I pause tail only; predictor stays off without W/rate
    Tuning pred = compensated();
    pred.derivFilterS = 0.0f;
    pred.integralZone = 0.0f;
    const Result rf = simulate(filt);
    const Result rz = simulate(zone);
    const Result rp = simulate(pred);
    report("D filter only", rf);
    report("integral zone + pause only", rz);
    report("predictor only", rp);
    Tuning slow;
    slow.derivFilterS = 8.0f;
    report("D filter 8 s only", simulate(slow));

    TEST_ASSERT_TRUE(rf.peak <= legacy.peak + 1.25f);
    TEST_ASSERT_TRUE(rf.idleSwing < 0.5f * legacy.idleSwing); // ~3x less chatter (2.5 vs 7.4)
    // On the fitted plant most of the overshoot is element heat still arriving, which the integral can't see coming:
    // the zone alone trims it a little (3.0 -> 2.75 °C) but mustn't make it worse.
    TEST_ASSERT_TRUE(rz.peak <= legacy.peak);
    // 75 %: the sensor's 0.25 degC steps make the simulated peak move in quarter-degree jumps.
    TEST_ASSERT_TRUE(rp.peak - 98.0f < 0.75f * (legacy.peak - 98.0f));
    TEST_ASSERT_TRUE(rp.settleErr < 0.3f);
}

// The model is rarely exact: ±25 % on heat-up rate and dead time must stay stable and still beat the legacy loop.
void test_robust_to_model_mismatch() {
    const Result legacy = simulate(Tuning{});
    const std::array<float, 2> rates = {0.45f, 0.75f};
    const std::array<float, 2> deads = {15.0f, 25.0f};
    for (float rate : rates) {
        for (float dead : deads) {
            Tuning tu = compensated();
            tu.modelRate = rate;
            tu.modelDeadS = dead;
            const Result r = simulate(tu);
            std::array<char, 64> name{};
            snprintf(name.data(), name.size(), "mismatch rate %.2f dead %.0f", rate, dead);
            report(name.data(), r);
            TEST_ASSERT_TRUE_MESSAGE(r.peak < legacy.peak, name.data());
            TEST_ASSERT_TRUE_MESSAGE(r.settleErr < 0.4f, name.data());
            TEST_ASSERT_TRUE_MESSAGE(r.idleP2P <= 0.75f, name.data());
        }
    }
}

// Switching the predictor on while the PID holds setpoint, as on the bench: from zero loss it reads the ~65 W holding
// power as heat in flight and sags the boiler by about dead time x holding power / capacity (0.49 degC measured on a
// Silvia) until the loss is learned. The default guess shrinks that and a saved value removes it.
void test_separate_water_delay() {
    Tuning sharedTuning = compensated();
    sharedTuning.waterDeadS = 0.0f; // 0 = use the 20 s sensor dead time (compensated() sets 12 s)
    const Result shared = simulate(sharedTuning);
    report("water delay = dead time (20 s)", shared);
    const std::array<float, 3> delays = {5.0f, 8.0f, 12.0f};
    for (float d : delays) {
        Tuning tu = compensated();
        tu.waterDeadS = d;
        const Result r = simulate(tu);
        std::array<char, 48> name{};
        snprintf(name.data(), name.size(), "water delay %.0f s", d);
        report(name.data(), r);
        TEST_ASSERT_TRUE_MESSAGE(r.settleErr < 0.3f, name.data());
        TEST_ASSERT_TRUE_MESSAGE(r.idleP2P <= 0.5f, name.data());
    }
}

void test_seeded_start_avoids_sag() {
    Tuning zero = compensated();
    zero.lossSeedW = -1.0f;
    zero.predictorStartS = 600.0f;
    Tuning guess = compensated(); // default: 5 % of 1100 W = 55 W
    guess.predictorStartS = 600.0f;
    Tuning saved = compensated();
    saved.lossSeedW = 65.0f;
    saved.predictorStartS = 600.0f;
    const Result rz = simulate(zero);
    const Result rg = simulate(guess);
    const Result rs = simulate(saved);
    printf("start sag: from zero %.2f, default guess %.2f, saved value %.2f degC\n", rz.startSag, rg.startSag, rs.startSag);
    TEST_ASSERT_TRUE(rz.startSag < -0.4f);
    TEST_ASSERT_TRUE(rg.startSag > 0.5f * rz.startSag);
    TEST_ASSERT_TRUE(rs.startSag > -0.3f); // within one 0.25 degC sensor step, i.e. idle noise
}

// The bench configurations (Kp 60 / Ki 0.658 / Kd 1500, 5 s flush from 93 °C): the plant should rank them as the
// Silvia did. Bench overshoot: off +2.91, shared 20 s delay +1.68, 12 s water delay +0.63 °C.
void test_bench_configurations() {
    Tuning off;
    off.kd = 1500.0f;
    off.plantInletC = 25.0f;
    Tuning shared = compensated();
    shared.waterDeadS = 0.0f;
    shared.plantInletC = 25.0f;
    Tuning water = compensated();
    water.plantInletC = 25.0f;
    const Result ro = simulate(off);
    const Result rs = simulate(shared);
    const Result rw = simulate(water);
    report("bench: off", ro);
    report("bench: shared 20 s delay", rs);
    report("bench: 12 s water delay", rw);
}

// A logged shot (Londonium on a Silvia, 2026-10-29: 5 s fill at ~8.8 ml/s, 10 s infusion, then 9 bar at 0.8-2.2 ml/s; 38 g
// in the cup), replayed at the profile's 88 °C (93 boiler). On the bench the sensor fell 5.8 °C (87.7 -> 81.9) while the
// heater backed off to 22-33 %: the integral is held while water flows, so only P answers a steady draw. The plant
// gives 6.5 °C. Most of it is physics: the 5 s fill draws ~45 ml (~11 kJ, ~2 kW) faster than the 1100 W element can
// replace, and heater heat reaches the water with a ~21 s time constant, mostly after the shot. So the thermal
// feedforward (kf) lifts the sensor's low by ~2 °C but the water's by only ~0.6 °C; only heat
// put in before the shot (idling hotter) lifts the water itself.
static const std::vector<float> LONDONIUM_SHOT = {0.19f, 8.17f, 8.84f, 8.85f, 8.94f, 8.74f, 5.94f, 1.73f, 1.07f, 0.24f,
                                                  0.01f, 0.1f,  0.29f, 0.26f, 0.22f, 0.16f, 4.87f, 0.87f, 0.76f, 0.84f,
                                                  1.0f,  1.06f, 1.17f, 1.27f, 1.4f,  1.51f, 1.61f, 1.73f, 1.79f, 1.88f,
                                                  1.95f, 1.99f, 2.02f, 2.06f, 2.15f, 2.14f, 2.22f, 2.2f};

void test_shot_feedforward() {
    Tuning base = compensated();
    base.flowProfile = LONDONIUM_SHOT;
    base.setpointC = 93.0f;
    base.plantInletC = 32.0f;
    base.predictorInletC = 32.0f;
    const Result rb = simulate(base);
    printf("shot, no feedforward:   sensor low %.2f (%.2f under), water low %.2f, peak after %.2f\n", rb.dipMin,
           rb.dipMin - 93.0f, rb.waterLow, rb.peak);
    Tuning ffFull = base;
    ffFull.kff = 0.909f; // the water's heat exactly
    const Result rr = simulate(ffFull);
    Result hot3{};
    for (float pre : {1.0f, 2.0f, 3.0f}) {
        Tuning hot = base;
        hot.setpointC = 93.0f + pre; // idle a little above, as a pre-heat
        const Result rh2 = simulate(hot);
        printf("shot, idle %.0f °C over:   sensor low %.2f (%.2f vs 93), water low %.2f, peak after %.2f\n", pre, rh2.dipMin,
               rh2.dipMin - 93.0f, rh2.waterLow, rh2.peak);
        hot3 = rh2;
    }
    TEST_ASSERT_TRUE_MESSAGE(rb.dipMin < 93.0f - 5.0f, "plant should reproduce the bench shot's ~6 °C drop");
    TEST_ASSERT_TRUE(rr.dipMin > rb.dipMin + 1.0f);       // feedforward lifts the sensor's low
    TEST_ASSERT_TRUE(rr.waterLow < rb.waterLow + 1.0f);   // ... but hardly the water's: the element can't keep up
    TEST_ASSERT_TRUE(hot3.waterLow > rb.waterLow + 2.0f); // heat put in before the shot does
    const std::array<float, 3> gains = {0.45f, 0.7f, 0.909f};
    for (float k : gains) {
        Tuning ff = base;
        ff.kff = k;
        const Result r = simulate(ff);
        printf("shot, feedforward %.3f: sensor low %.2f (%.2f under), water low %.2f, peak after %.2f, settle err %.2f\n", k,
               r.dipMin, r.dipMin - 93.0f, r.waterLow, r.peak, r.settleErr);
    }
}

// Silvia Daily 18-36 on the Olab pump (2026-11-03 14:45, the finer of two shots): 5 s fill at ~5.8 ml/s, a 3 bar soak, then
// 9 bar falling to 7 at 1.4-1.9 ml/s; 36.3 g in 33 s, tank estimate 30.5 °C. The sensor fell 3.3 °C (93 -> 89.7) and
// took ~110 s to climb back with the heater at 5-18 %: once the predictor's window has passed, only P (Kp 60, 6 % per
// °C) answers the shortfall, and the integral is held outside its 1.5 °C zone. The thermal feedforward (kf) adds the
// water's heat while it flows.
static const std::vector<float> DAILY_SHOT = {2.69f, 5.74f, 5.89f, 5.83f, 5.66f, 3.37f, 1.31f, 0.64f, 0.43f, 0.43f, 0.96f,
                                              1.48f, 1.45f, 1.48f, 1.35f, 1.36f, 1.41f, 1.49f, 1.58f, 1.63f, 1.67f, 1.74f,
                                              1.80f, 1.80f, 1.79f, 1.82f, 1.83f, 1.83f, 1.85f, 1.86f, 1.84f, 1.86f, 1.84f};

void test_daily_shot_feedforward() {
    for (float k : {0.0f, 0.3f, 0.45f, 0.7f, 0.909f}) {
        Tuning tu = compensated();
        tu.flowProfile = DAILY_SHOT;
        tu.setpointC = 93.0f;
        tu.plantInletC = 30.5f;
        tu.predictorInletC = 30.5f;
        tu.kff = k;
        const Result r = simulate(tu);
        printf("daily shot, kf %.3f: sensor low %.2f (%+.2f), water low %.2f (%+.2f), back at %4.0f s, peak after %+.2f, "
               "settle err %.2f\n",
               k, r.dipMin, r.dipMin - 93.0f, r.waterLow, r.waterLow - 93.0f, r.backAt, r.peak - 93.0f, r.settleErr);
        Tuning fl = compensated();
        fl.kff = k;
        const Result f = simulate(fl);
        printf("  5 s flush at 98, kf %.3f: low %.2f, peak %+.2f, back at %4.0f s, settle err %.2f\n", k, f.dipMin,
               f.peak - 98.0f, f.backAt, f.settleErr);
    }
}

// Heat-up from below the setpoint: a warm restart (the morning case, boiler ~22 °C under with the group head colder still)
// and a switch to steam. The loop as on the machine (bench 2026-10-30 morning): the predictor counts the full
// power's heat in flight (~12 °C) and Kd 1500 brakes on the rise, so the heater fell to ~10-20 % while still 10-30 °C
// under. HeatUpBoost (Heater::loopPid): full power while the predicted temperature is more than 5 °C under.
struct HeatUp {
    float reach;   // s until the sensor is first within `near` (0.5 °C) of the setpoint
    float over;    // highest sensor reading above the setpoint after that
    float settled; // s until the sensor stays within ±0.3 °C (last time outside)
    float duty;    // mean output (0..1) over the first 120 s
};

// afterShot: a shot ended just before (the boost sees a flush 0 s ago); trickle: steam pump assist into the boiler (ml/s).
// Plant for the heat-up runs: the flush fit (default), or the fit to logged warm-ups (scripts/fit_warmup.py, 2026-11-02:
// the 6:45 and 8:09 warm-ups, standing loss pinned to the 47 W holding power). It reproduces those warm-ups closed loop
// (overshoot, then a 2-3.5 °C sag for ~10 min while the group head soaks up heat); the flush fit doesn't.
struct Plant {
    float wallC;
    float waterC;
    float wallToWater;
    float groupC;
    float waterToGroup;
    float lossPerK;
};
static constexpr Plant FLUSH_PLANT{200.0f, 1296.0f, 9.6f, 819.0f, 5.7f, 0.59f};
static constexpr Plant WARMUP_PLANT{215.8f, 1213.9f, 9.2f, 1342.8f, 4.3f, 47.0f / 76.0f};
static Plant heatUpPlant = FLUSH_PLANT;
static float lastHeatUpSag = 0.0f; // lowest reading under the setpoint after first reaching it (last simulateHeatUp)

static HeatUp simulateHeatUp(const Tuning &tu, float startC, float groupBelowC, float setpoint, bool afterShot = false,
                             float trickle = 0.0f, float near = 0.5f) {
    const float dt = 0.25f;
    const float room = 22.0f;
    const float lossPerK = heatUpPlant.lossPerK;
    const float plantW = 1100.0f;
    const float wallC = heatUpPlant.wallC;
    const float waterC = heatUpPlant.waterC;
    const float wallToWater = heatUpPlant.wallToWater;
    const float groupC = heatUpPlant.groupC;
    const float waterToGroup = heatUpPlant.waterToGroup;
    lastHeatUpSag = 0.0f;
    const float delayS = 4.6f;
    const float lagS = 15.0f;
    const auto delaySteps = static_cast<int>(delayS / dt);
    const float holdW = lossPerK * (startC - room);
    float boiler = startC;
    float wall = startC + holdW / wallToWater;
    float group = startC - holdW / waterToGroup - groupBelowC;
    std::deque<float> pipe(delaySteps, boiler);
    float lagged = boiler;
    float ema = boiler;
    float output = 0.0f;
    float control = boiler;
    float measured = boiler;
    float sp = setpoint;
    SimplePID pid(&output, &control, &sp);
    pid.setDerivativeInput(&measured);
    pid.setSamplingFrequency(1.0f);
    pid.setCtrlOutputLimits(0.0f, 1000.0f);
    pid.activateSetPointFilter(false);
    pid.setControllerPIDGains(tu.kp, tu.ki, tu.kd, 0.0f);
    pid.setDerivativeFilterTime(tu.derivFilterS);
    pid.setIntegralZone(tu.integralZone);
    pid.reset();
    pid.setMode(SimplePID::Control::automatic);
    HeatBalancePredictor predictor;
    predictor.configure(tu.modelW, tu.modelRate, tu.modelDeadS, tu.predictorInletC, tu.waterDeadS);
    predictor.seedLoss(tu.lossSeedW);
    HeatUp r{-1.0f, -1e9f, 0.0f, 0.0f};
    float dutySum = 0.0f;
    float lastOut = -1.0f;
    int dutyN = 0;
    const float end = 1500.0f;
    fakeNow = 1000;
    for (int step = 0; step * dt < end; ++step) {
        const float t = step * dt;
        if (step % 4 == 0) {
            fakeNow += 1000;
            measured = ema;
            predictor.update(1.0f, output / 1000.0f, trickle, measured, sp);
            control = measured + predictor.getCorrection();
            pid.update();
            const auto sinceShot = static_cast<uint32_t>(t * 1000.0f);
            if (tu.heatUpBoost && HeatUpBoost::active(predictor.isEnabled(), sp, control, afterShot, sinceShot))
                output = 1000.0f;
            if (t < 120.0f) {
                dutySum += output / 1000.0f;
                ++dutyN;
            }
            if (r.reach < 0.0f && measured >= sp - near)
                r.reach = t;
            if (r.reach >= 0.0f) {
                r.over = std::max(r.over, measured - sp);
                lastHeatUpSag = std::min(lastHeatUpSag, measured - sp);
            }
            if (std::fabs(measured - sp) > 0.3f)
                lastOut = t;
        }
        const float heat = plantW * output / 1000.0f;
        const float toWater = wallToWater * (wall - boiler);
        const float toGroup = waterToGroup * (boiler - group);
        const float water = trickle * 4.18f * (boiler - tu.plantInletC);
        wall += (heat - toWater) * dt / wallC;
        group += (toGroup - lossPerK * (boiler - room)) * dt / groupC;
        boiler += (toWater - water - toGroup) * dt / waterC;
        pipe.push_back(boiler);
        const float delayed = pipe.front();
        pipe.pop_front();
        lagged += (delayed - lagged) * dt / lagS;
        ema = 0.2f * (std::floor(lagged * 4.0f) / 4.0f) + 0.8f * ema;
    }
    r.settled = lastOut;
    r.duty = dutySum / static_cast<float>(dutyN);
    return r;
}

static void test_heat_up_boost() {
    Tuning tu = compensated();
    tu.lossSeedW = 36.0f;
    struct Case {
        const char *name;
        float start;
        float groupBelow;
        float sp;
        bool afterShot;
        float trickle;
        float near;
    };
    const std::vector<Case> cases = {{"warm restart 76->98, group -15", 76.0f, 15.0f, 98.0f, false, 0.0f, 0.5f},
                                     {"warm restart 76->98, group even", 76.0f, 0.0f, 98.0f, false, 0.0f, 0.5f},
                                     {"cold start 25->98", 25.0f, 0.0f, 98.0f, false, 0.0f, 0.5f},
                                     {"steam 98->125", 98.0f, 0.0f, 125.0f, false, 0.0f, 0.5f},
                                     // The usual routine: steam straight after a shot, with pump assist trickling in (machine,
                                     // 2026-10-30). Within 1 °C: at steam the climb matters, not the last half degree (the 1.5 °C
                                     // integral zone leaves the trickle's load ~3 °C under either way).
                                     {"steam after a shot, assist 0.4 ml/s", 95.0f, 0.0f, 125.0f, true, 0.4f, 1.0f}};
    for (const auto &c : cases) {
        Tuning off = tu;
        off.heatUpBoost = false;
        const HeatUp before = simulateHeatUp(off, c.start, c.groupBelow, c.sp, c.afterShot, c.trickle, c.near);
        const HeatUp after = simulateHeatUp(tu, c.start, c.groupBelow, c.sp, c.afterShot, c.trickle, c.near);
        printf("%-36s within %.1f °C %4.0f -> %4.0f s  over %+5.2f -> %+5.2f  settled %4.0f -> %4.0f s\n", c.name, c.near,
               before.reach, after.reach, before.over, after.over, before.settled, after.settled);
        // Within half a degree in under 3 minutes (from 6-10), no more than 2 °C over, and settled no later than before.
        TEST_ASSERT_TRUE(after.reach > 0.0f && after.reach < 180.0f);
        TEST_ASSERT_TRUE(before.reach < 0.0f || after.reach < 0.5f * before.reach); // -1: never got there
        TEST_ASSERT_TRUE(after.over < 2.0f);
        TEST_ASSERT_TRUE(c.trickle > 0.0f || after.settled <= before.settled + 60.0f);
    }
}

// Kp sweep on the machine's settings (2026-11-03: kf 0.45). After a shot the feedforward stops
// with the water, and at Kp 60 the last 1-2 °C crawls back at 5-10 % heater (shot 3: 92.2 °C 50 s after the stop).
// The predictor already takes the sensor's lag out of the error, so the loop may carry more gain than the autotune's.
void test_kp_sweep() {
    struct G {
        float kp;
        float ki;
    };
    for (G g : {G{60, 0.658f}, G{100, 0.658f}, G{60, 1.5f}, G{60, 3.0f}, G{60, 5.0f}, G{80, 2.0f}}) {
        const float kp = g.kp;
        Tuning tu = compensated();
        tu.kp = kp;
        tu.ki = g.ki;
        tu.kff = 0.45f;
        tu.lossSeedW = 33.0f;
        heatUpPlant = FLUSH_PLANT;
        const Result f = simulate(tu);
        Tuning sh = tu;
        sh.flowProfile = DAILY_SHOT;
        sh.setpointC = 93.0f;
        sh.plantInletC = 30.5f;
        sh.predictorInletC = 30.5f;
        const Result s = simulate(sh);
        heatUpPlant = WARMUP_PLANT;
        const HeatUp cold = simulateHeatUp(tu, 28.2f, 0.0f, 98.0f);
        const float coldSag = lastHeatUpSag;
        const HeatUp warm = simulateHeatUp(tu, 63.0f, 0.0f, 98.0f);
        heatUpPlant = FLUSH_PLANT;
        const HeatUp steam = simulateHeatUp(tu, 98.0f, 0.0f, 125.0f);
        printf(
            "kp %5.1f ki %.2f | idle p2p %.2f swing %5.1f | flush low %.2f peak %+.2f back %4.0f s | shot low %.2f back %4.0f s "
            "peak %+.2f | cold over %+.2f sag %+.2f settled %4.0f | warm over %+.2f settled %4.0f | steam over %+.2f "
            "settled %4.0f\n",
            kp, g.ki, f.idleP2P, f.idleSwing, f.dipMin, f.peak - 98.0f, f.backAt, s.dipMin, s.backAt, s.peak - 93.0f, cold.over,
            coldSag, cold.settled, warm.over, warm.settled, steam.over, steam.settled);
    }
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_disabled_when_any_parameter_missing);
    RUN_TEST(test_full_power_correction_is_rate_times_dead_time);
    RUN_TEST(test_partial_step_inside_delay_counts_in_part);
    RUN_TEST(test_correction_decays_after_heater_off);
    RUN_TEST(test_flush_gives_immediate_negative_correction);
    RUN_TEST(test_flush_correction_scales_with_inlet_temperature);
    RUN_TEST(test_water_delay_drains_flush_sooner);
    RUN_TEST(test_water_delay_leaves_heater_delay_alone);
    RUN_TEST(test_steady_state_correction_converges_to_zero);
    RUN_TEST(test_loss_learned_at_brew_holds_at_steam);
    RUN_TEST(test_correction_is_bounded);
    RUN_TEST(test_identical_reconfigure_keeps_state);
    RUN_TEST(test_first_seed_uses_default_fraction);
    RUN_TEST(test_saved_seed_applies_once);
    RUN_TEST(test_seed_waits_for_enable_and_is_bounded);
    RUN_TEST(test_flush_overshoot_is_reduced);
    RUN_TEST(test_individual_features);
    RUN_TEST(test_robust_to_model_mismatch);
    RUN_TEST(test_seeded_start_avoids_sag);
    RUN_TEST(test_separate_water_delay);
    RUN_TEST(test_bench_configurations);
    RUN_TEST(test_shot_feedforward);
    RUN_TEST(test_daily_shot_feedforward);
    RUN_TEST(test_heat_up_boost);
    RUN_TEST(test_long_gap_is_not_counted_as_heat);
    RUN_TEST(test_kp_sweep);
    return UNITY_END();
}
