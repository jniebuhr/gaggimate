// Unit tests: flow-derived mushroom-valve pressure offset (valveOffsetAt).
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_valve_offset.
//
// Reference numbers come from a DeLonghi ECP 3420 valve characterisation: cracking ~4.0 bar,
// ~6.6 bar at 4.45 g/s at 100% pump duty, and a measured drop-vs-flow line of ~0.712*F + 4.103
// across the extraction band.

#include <unity.h>

#include <cmath>
#include <limits>

#include "display/core/ValveOffset.h"

// The two calibration points a user would enter after the documented procedure, using this
// machine's measured flows.
static constexpr float P1 = 5.0f;
static constexpr float F1 = 1.19f;
static constexpr float P2 = 6.0f;
static constexpr float F2 = 2.90f;
static constexpr float FIXED = 5.0f; // the fallback constant offset
// Measured with the portafilter out and the pump at 100% duty: the most drop this machine can
// produce. Required — the model has no ceiling of its own.
static constexpr float PMAX = 6.60f;
static constexpr float FMAX = 4.45f;
static constexpr float NO_CAP = 0.0f;    // an uncalibrated ceiling
static constexpr float HIGH_CAP = 99.0f; // so far above the line it never binds

// The model as the firmware evaluates it: always capped.
static float derived(float flow) { return valveOffsetAt(flow, FIXED, true, P1, F1, P2, F2, PMAX); }
// The bare line, for tests that need to see what the cap is protecting against.
static float uncapped(float flow) { return valveOffsetAt(flow, FIXED, true, P1, F1, P2, F2, HIGH_CAP); }

// --- constant mode is untouched -------------------------------------------------------------

void test_constant_mode_ignores_flow(void) {
    for (float q : {0.0f, 1.0f, 2.0f, 9.9f}) {
        TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(q, FIXED, false, P1, F1, P2, F2, PMAX));
    }
}

void test_constant_mode_passes_zero_through(void) {
    // The 3-way-solenoid default: offset 0 must stay exactly 0.
    TEST_ASSERT_EQUAL_FLOAT(0.0f, valveOffsetAt(1.5f, 0.0f, false, P1, F1, P2, F2, PMAX));
}

// --- the line itself -------------------------------------------------------------------------

void test_line_passes_through_both_calibration_points(void) {
    TEST_ASSERT_FLOAT_WITHIN(0.001f, P1, derived(F1));
    TEST_ASSERT_FLOAT_WITHIN(0.001f, P2, derived(F2));
}

void test_offset_rises_with_flow(void) {
    TEST_ASSERT_TRUE(derived(2.0f) > derived(1.0f));
    TEST_ASSERT_TRUE(derived(1.0f) > derived(0.5f));
}

void test_matches_measured_valve_curve_in_the_extraction_band(void) {
    // Against a measured curve, 0.7100*F + 4.110, fitted where shots actually run. The
    // calibration is a chord across a concave curve, so it over-reads at the bottom of the band
    // and under-reads at the top; a measured worst case is +0.075 to -0.058 bar.
    for (float q : {0.95f, 1.19f, 1.40f, 1.60f, 1.85f, 2.01f}) {
        const float reference = 0.7100f * q + 4.110f;
        TEST_ASSERT_FLOAT_WITHIN(0.08f, reference, derived(q));
    }
}

void test_known_operating_points(void) {
    // Anchors a human can check by hand: slope 1/(2.90-1.19) = 0.5848 bar per g/s,
    // intercept 5.0 - 0.5848*1.19 = 4.3041.
    TEST_ASSERT_FLOAT_WITHIN(0.005f, 4.8889f, derived(1.0f));
    TEST_ASSERT_FLOAT_WITHIN(0.005f, 5.4737f, derived(2.0f));
}

// --- guards: anything unusable must fall back to the fixed offset -----------------------------

void test_equal_flows_fall_back(void) {
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, 5.0f, 1.19f, 6.0f, 1.19f, PMAX));
}

void test_inverted_flows_fall_back(void) {
    // A negative slope — more flow, less drop — is impossible for this valve.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, 5.0f, 2.90f, 6.0f, 1.19f, PMAX));
}

void test_inverted_pressures_fall_back(void) {
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, 6.0f, 1.19f, 5.0f, 2.90f, PMAX));
}

void test_implausible_slope_falls_back(void) {
    // The fat-finger case: two flows one digit apart give a slope of 100 bar per g/s.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, 5.0f, 1.19f, 6.0f, 1.20f, PMAX));
    // And the opposite, a slope far too shallow to be a spring valve.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, 5.0f, 1.0f, 6.0f, 20.0f, PMAX));
}

void test_non_finite_inputs_fall_back(void) {
    const float nan = std::nanf("");
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(nan, FIXED, true, P1, F1, P2, F2, PMAX));
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, nan, F1, P2, F2, PMAX));
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, P1, F1, P2, nan, PMAX));
}

void test_uncalibrated_defaults_fall_back(void) {
    // Both flows still at their 0.0 default: the mode is on but nothing has been measured.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, DEFAULT_VALVE_CAL_P1, DEFAULT_VALVE_CAL_F1,
                                                 DEFAULT_VALVE_CAL_P2, DEFAULT_VALVE_CAL_F2, DEFAULT_VALVE_CAL_PMAX));
}

void test_unset_first_flow_falls_back(void) {
    // A half-filled calibration: f1 never set, so it still holds its 0.0 default while everything
    // around it looks plausible. The implied slope of 0.5 bar per g/s sits inside the accepted
    // band, so no other guard catches it — this is the state a partial write over the API leaves.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.0f, FIXED, true, 5.0f, DEFAULT_VALVE_CAL_F1, 6.0f, 2.0f, 6.6f));
    // A negative first flow is no more measurable, and the registry would accept it too.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.0f, FIXED, true, 5.0f, -1.0f, 6.0f, 2.0f, 6.6f));
}

void test_unset_first_pressure_falls_back(void) {
    // A cleared P1 field reaches the registry as 0, because String::toFloat() renders "" as zero.
    // p2 > p1 is satisfied by any positive p2, so the slope band is the only other obstacle — and
    // a wide span clears it: 5 / (4 - 1) is 1.67, inside 0.3-2.0.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(2.0f, FIXED, true, 0.0f, 1.0f, 5.0f, 4.0f, 6.6f));
    // A negative first pressure is no more a measurement, and the registry would accept it too.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(2.0f, FIXED, true, -1.0f, 1.0f, 5.0f, 4.0f, 6.6f));
}

void test_negative_flow_does_not_invert_the_offset(void) {
    // A spurious negative reading must not pull the offset below the cracking intercept.
    TEST_ASSERT_EQUAL_FLOAT(derived(0.0f), derived(-3.0f));
}

// --- the ceiling is required ------------------------------------------------------------------

void test_missing_cap_falls_back(void) {
    // The ceiling is not optional: an uncalibrated one leaves the line unbounded, so the model is
    // treated as incomplete and the fixed offset is used instead.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, P1, F1, P2, F2, NO_CAP));
}

void test_cap_at_or_below_the_second_point_falls_back(void) {
    // Honouring it would clip a pressure the user measured, so it is treated as uncalibrated.
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, P1, F1, P2, F2, P2));
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, P1, F1, P2, F2, 5.5f));
}

void test_non_finite_cap_falls_back(void) {
    const float nan = std::numeric_limits<float>::quiet_NaN();
    const float inf = std::numeric_limits<float>::infinity();
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, P1, F1, P2, F2, nan));
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(1.5f, FIXED, true, P1, F1, P2, F2, inf));
}

void test_cap_does_not_apply_in_constant_mode(void) {
    TEST_ASSERT_EQUAL_FLOAT(FIXED, valveOffsetAt(9.0f, FIXED, false, P1, F1, P2, F2, PMAX));
}

// --- what the cap does ------------------------------------------------------------------------

void test_cap_does_not_touch_the_extraction_band(void) {
    // The line reaches PMAX at (PMAX - intercept)/slope = 3.93 g/s. A shot lives well below that,
    // so capping must leave brewing pressures bit-identical to the bare line.
    for (float q : {0.4f, 0.8f, 1.2f, 1.6f, 2.0f, 2.5f, 3.0f}) {
        TEST_ASSERT_EQUAL_FLOAT(uncapped(q), derived(q));
    }
}

void test_cap_holds_above_the_crossing_flow(void) {
    // Fill-phase flows, where the bare line claims more than the machine can produce.
    TEST_ASSERT_FLOAT_WITHIN(0.01f, PMAX, derived(4.0f));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, PMAX, derived(FMAX));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, PMAX, derived(5.28f)); // the peak seen on shot 206
    TEST_ASSERT_FLOAT_WITHIN(0.01f, PMAX, derived(99.0f));
}

void test_bare_line_would_overshoot_the_ceiling(void) {
    // Guards the premise: without a ceiling the model really does ask for more than 6.60 bar,
    // which is the defect the cap exists to prevent. If this fails the calibration has changed.
    TEST_ASSERT_TRUE(uncapped(FMAX) > PMAX);
    TEST_ASSERT_TRUE(uncapped(5.28f) > PMAX);
}

void test_offset_never_goes_negative(void) {
    // The permitted slope band allows a calibration whose line is below zero at low flow.
    // A restriction subtracts pressure, so the result is floored rather than inverting the sign.
    TEST_ASSERT_EQUAL_FLOAT(0.0f, valveOffsetAt(0.0f, FIXED, true, 1.0f, 1.0f, 3.0f, 2.0f, 10.0f));
    TEST_ASSERT_TRUE(valveOffsetAt(0.2f, FIXED, true, 1.0f, 1.0f, 3.0f, 2.0f, 10.0f) >= 0.0f);
}

// --- the commanded system pressure stays sane -------------------------------------------------

void test_extraction_regime_command_stays_clear_of_the_gain_cliff(void) {
    // Nothing downstream clamps the setpoint, and the controller's gain schedule runs away as
    // measured pressure approaches 15. During extraction the pump bounds the flow, so across that
    // whole regime 9 + offset must stay clear of the cliff.
    // Stepped with an integer counter so the 0.05 increment cannot accumulate rounding error.
    for (int step = 0; step <= 34; ++step) {
        const float q = 0.05f * static_cast<float>(step);
        TEST_ASSERT_TRUE(9.0f + derived(q) < 14.5f);
    }
}

void test_fill_regime_command_is_bounded_by_the_cap(void) {
    // During fill, pressure is low and flow of 3-4 g/s is normal. The ceiling is what keeps the
    // commanded pressure bounded there: it can never exceed target + PMAX, however high flow goes.
    for (float q : {3.0f, 4.0f, 4.45f, 5.28f, 20.0f}) {
        TEST_ASSERT_TRUE(derived(q) <= PMAX + 0.001f);
    }
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 14.60f, 8.0f + derived(5.28f));
    TEST_ASSERT_TRUE(8.0f + uncapped(5.28f) > 15.0f); // what it would have been uncapped
}

void setUp(void) { /* No shared fixture state. */ }
void tearDown(void) { /* No shared fixture state. */ }

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_constant_mode_ignores_flow);
    RUN_TEST(test_constant_mode_passes_zero_through);
    RUN_TEST(test_line_passes_through_both_calibration_points);
    RUN_TEST(test_offset_rises_with_flow);
    RUN_TEST(test_matches_measured_valve_curve_in_the_extraction_band);
    RUN_TEST(test_known_operating_points);
    RUN_TEST(test_equal_flows_fall_back);
    RUN_TEST(test_inverted_flows_fall_back);
    RUN_TEST(test_inverted_pressures_fall_back);
    RUN_TEST(test_implausible_slope_falls_back);
    RUN_TEST(test_non_finite_inputs_fall_back);
    RUN_TEST(test_uncalibrated_defaults_fall_back);
    RUN_TEST(test_unset_first_flow_falls_back);
    RUN_TEST(test_unset_first_pressure_falls_back);
    RUN_TEST(test_negative_flow_does_not_invert_the_offset);
    RUN_TEST(test_missing_cap_falls_back);
    RUN_TEST(test_cap_at_or_below_the_second_point_falls_back);
    RUN_TEST(test_non_finite_cap_falls_back);
    RUN_TEST(test_cap_does_not_apply_in_constant_mode);
    RUN_TEST(test_cap_does_not_touch_the_extraction_band);
    RUN_TEST(test_cap_holds_above_the_crossing_flow);
    RUN_TEST(test_bare_line_would_overshoot_the_ceiling);
    RUN_TEST(test_offset_never_goes_negative);
    RUN_TEST(test_extraction_regime_command_stays_clear_of_the_gain_cliff);
    RUN_TEST(test_fill_regime_command_is_bounded_by_the_cap);
    return UNITY_END();
}
