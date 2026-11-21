// Unit tests: SimplePID derivative-on-measurement, derivative filter, integral zone and integral hold.
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_simple_pid.

#include <unity.h>

#include <cmath>
#include <cstdint>

// Arduino surface SimplePID.cpp uses; the native Arduino.h stub on the include path is empty.
static uint32_t fakeNow = 0;
static uint32_t millis() { return fakeNow; }
#define constrain(x, lo, hi) ((x) < (lo) ? (lo) : ((x) > (hi) ? (hi) : (x)))
#define ESP_LOGV(...)
#ifndef PI
#define PI 3.14159265358979323846f
#endif

#include "SimplePID/SimplePID.cpp"

struct Rig {
    float output = 0.0f;
    float input = 90.0f;
    float setpoint = 93.0f;
    SimplePID pid{&output, &input, &setpoint};

    Rig(float kp, float ki, float kd) {
        fakeNow = 1000;
        pid.setSamplingFrequency(1.0f);
        pid.setCtrlOutputLimits(-100000.0f, 100000.0f); // wide: these tests look at the raw terms
        pid.activateSetPointFilter(false);
        pid.setControllerPIDGains(kp, ki, kd, 0.0f);
        pid.reset();
        pid.setMode(SimplePID::Control::automatic);
    }
    // Advance one control period and run the controller.
    void step() {
        fakeNow += 1000;
        TEST_ASSERT_TRUE(pid.update());
    }
};

void setUp() { /* no shared fixture state */ }
void tearDown() { /* no shared fixture state */ }

// The first sample after (re)initialisation must not see a derivative kick from a zero previous value.
void test_no_derivative_kick_on_first_sample() {
    Rig r(0.0f, 0.0f, 1000.0f);
    r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, 0.0f, r.output);
}

// A setpoint step moves only the P term: the derivative acts on the measurement.
void test_setpoint_change_has_no_derivative_kick() {
    Rig r(10.0f, 0.0f, 1000.0f);
    r.step();
    r.setpoint = 120.0f; // e.g. switching to steam
    r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, 10.0f * (120.0f - 90.0f), r.output);
}

// Unfiltered and with a constant setpoint the D term is -Kd·dT/dt, the same as the legacy error derivative.
void test_unfiltered_derivative_matches_legacy() {
    Rig r(0.0f, 0.0f, 2800.0f);
    r.step();
    r.input += 0.25f; // one MAX31855 LSB
    r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-2f, -2800.0f * 0.25f, r.output);
}

// With a filter, one quantisation step only moves the output by Kd·step·dt/(tau+dt), and the filtered rate still
// converges to a real ramp.
void test_derivative_filter_smooths_steps_and_tracks_ramps() {
    Rig r(0.0f, 0.0f, 2800.0f);
    r.pid.setDerivativeFilterTime(9.0f);
    r.step();
    r.input += 0.25f;
    r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-2f, -2800.0f * 0.25f * 1.0f / 10.0f, r.output);

    for (int i = 0; i < 60; ++i) { // steady 0.3 °C/s rise
        r.input += 0.3f;
        r.step();
    }
    TEST_ASSERT_FLOAT_WITHIN(5.0f, -2800.0f * 0.3f, r.output);
}

void test_integral_zone_blocks_integration_outside_band() {
    Rig r(0.0f, 1.0f, 0.0f);
    r.pid.setIntegralZone(1.5f);
    r.input = 86.0f; // 7 °C below: outside the zone
    for (int i = 0; i < 10; ++i)
        r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.0f, r.pid.getIntegralState());

    r.input = 92.0f; // 1 °C below: inside
    for (int i = 0; i < 10; ++i)
        r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, 10.0f, r.pid.getIntegralState());
}

void test_integral_zone_zero_keeps_legacy_integration() {
    Rig r(0.0f, 1.0f, 0.0f);
    r.input = 86.0f;
    for (int i = 0; i < 10; ++i)
        r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, 70.0f, r.pid.getIntegralState());
}

void test_integral_hold_freezes_and_keeps_value() {
    Rig r(0.0f, 1.0f, 0.0f);
    r.input = 92.0f;
    for (int i = 0; i < 5; ++i)
        r.step();
    const float before = r.pid.getIntegralState();
    r.pid.setIntegralHold(true);
    for (int i = 0; i < 5; ++i)
        r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-4f, before, r.pid.getIntegralState());
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, before, r.output); // the held integral still drives the output
    r.pid.setIntegralHold(false);
    r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-3f, before + 1.0f, r.pid.getIntegralState());
}

// The saturation back-off must only undo integration that actually happened this sample.
void test_antiwindup_does_not_unwind_a_held_integral() {
    Rig r(0.0f, 1.0f, 0.0f);
    r.pid.setCtrlOutputLimits(0.0f, 1000.0f);
    r.input = 92.0f;
    for (int i = 0; i < 5; ++i)
        r.step();
    const float before = r.pid.getIntegralState();
    r.pid.setIntegralZone(0.5f); // now outside the zone, and the error still pushes the same way
    r.pid.setKp(5000.0f);        // saturate the output
    r.step();
    TEST_ASSERT_FLOAT_WITHIN(1e-4f, before, r.pid.getIntegralState());
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_no_derivative_kick_on_first_sample);
    RUN_TEST(test_setpoint_change_has_no_derivative_kick);
    RUN_TEST(test_unfiltered_derivative_matches_legacy);
    RUN_TEST(test_derivative_filter_smooths_steps_and_tracks_ramps);
    RUN_TEST(test_integral_zone_blocks_integration_outside_band);
    RUN_TEST(test_integral_zone_zero_keeps_legacy_integration);
    RUN_TEST(test_integral_hold_freezes_and_keeps_value);
    RUN_TEST(test_antiwindup_does_not_unwind_a_held_integral);
    return UNITY_END();
}
