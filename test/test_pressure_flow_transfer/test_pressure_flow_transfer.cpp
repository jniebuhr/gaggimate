// Regression and control-contract tests for the nightly pressure/flow selector.
// These use only the public controller API. Fixed pressure is a controller
// experiment; one test uses a synthetic hydraulic plant, not a replay of or
// an identified model for a physical machine.
#include <unity.h>

#include <algorithm>
#include <cmath>

#ifndef ESP_LOGI
#define ESP_LOGI(tag, fmt, ...) ((void)0)
#endif

#include "PressureController/PressureController.cpp"
#include "PressureController/PressureController.h"
#include "SimpleKalmanFilter/SimpleKalmanFilter.cpp"

void setUp() {}
void tearDown() {}

namespace {
using Mode = PressureController::ControlMode;
constexpr float dt = 0.03f;

struct Rig {
    float pressureTarget = 9.0f;
    float flowTarget = 0.0f;
    float pressure;
    float output = 0.0f;
    int valve = 1;
    PressureController controller;

    explicit Rig(float initialPressure = 8.0f, bool gear = true, float integralGain = 0.06f)
        : pressure(initialPressure), controller(dt, &pressureTarget, &flowTarget, &pressure, &output, &valve) {
        if (gear) {
            controller.setGains(0.09f, 1.8f, integralGain);
            controller.setPumpFlowCoeff(18.048410f, 8.695687f);
            controller.setPumpSlipPolyCoeffs(0.0f, -0.058623f, 1.676141f, 1.095481f);
        }
        controller.initSetpointFilter(pressureTarget);
        // POWER mode leaves the integral untouched while settling both filters.
        tick(Mode::POWER, 500);
    }

    void tick(Mode mode = Mode::FLOW, int count = 1) {
        for (int i = 0; i < count; ++i)
            controller.update(mode);
    }

    void buildPressureDuty(float targetDuty = 70.0f) {
        flowTarget = 0.0f;
        for (int i = 0; i < 2000 && output < targetDuty; ++i)
            tick(Mode::PRESSURE);
        TEST_ASSERT_TRUE_MESSAGE(output >= targetDuty, "Public pressure-only operation must build the handoff state");
    }
};

float fullDriveFlow(float pressure) {
    const float slope = (8.695687f - 18.048410f) / 8.0f;
    return 18.048410f + slope * (pressure - 1.0f);
}

float slip(float pressure) { return std::max(0.0f, -0.058623f * pressure * pressure + 1.676141f * pressure + 1.095481f); }

float gearFlowDuty(float pressure, float targetFlow = 2.4f) {
    return std::clamp(100.0f * (targetFlow + slip(pressure)) / (fullDriveFlow(pressure) + slip(pressure)), 0.0f, 100.0f);
}

void assertFiniteDuty(Rig &rig) {
    TEST_ASSERT_TRUE(std::isfinite(rig.output));
    TEST_ASSERT_TRUE(rig.output >= 0.0f);
    TEST_ASSERT_TRUE(rig.output <= 100.0f);
    TEST_ASSERT_TRUE(std::isfinite(rig.controller.getPumpFlowRate()));
}
} // namespace

static void test_gear_flow_handoff_has_no_next_cycle_collapse() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick();
    const float selectedDuty = rig.output;
    TEST_ASSERT_FLOAT_WITHIN(0.02f, gearFlowDuty(8.0f), selectedDuty);
    rig.tick();
    // The unpatched nightly loses its accumulated pressure command here.
    TEST_ASSERT_FLOAT_WITHIN(0.02f, selectedDuty, rig.output);
    rig.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.02f, selectedDuty, rig.output);
}

static void test_default_no_slip_model_also_has_bumpless_handoff() {
    Rig rig(8.5f, false);
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick();
    const float selectedDuty = rig.output;
    const float expected = 100.0f * 2.4f / (10.79f - 0.5854f * 8.5f);
    TEST_ASSERT_FLOAT_WITHIN(0.02f, expected, selectedDuty);
    rig.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.02f, selectedDuty, rig.output);
}

static void test_low_pressure_case_keeps_flow_without_collapse() {
    Rig rig(4.0f);
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    for (int i = 0; i < 200; ++i) {
        rig.tick();
        TEST_ASSERT_FLOAT_WITHIN(0.02f, gearFlowDuty(4.0f), rig.output);
    }
}

static void test_flow_control_remains_stable_for_one_thousand_ticks() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    for (int i = 0; i < 1000; ++i) {
        rig.tick();
        TEST_ASSERT_FLOAT_WITHIN(0.02f, gearFlowDuty(8.0f), rig.output);
    }
    TEST_ASSERT_FLOAT_WITHIN(0.002f, 2.4f, rig.controller.getPumpFlowRate());
}

static void test_mode_labels_do_not_disrupt_a_combined_selector() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick();
    const float selectedDuty = rig.output;
    for (int i = 0; i < 100; ++i) {
        rig.tick(i % 2 == 0 ? Mode::PRESSURE : Mode::FLOW);
        TEST_ASSERT_FLOAT_WITHIN(0.02f, selectedDuty, rig.output);
    }
}

static void test_pressure_increase_can_reduce_duty_on_first_filtered_sample() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    const float before = rig.output;
    rig.pressure = 10.0f;
    rig.tick();
    TEST_ASSERT_TRUE_MESSAGE(rig.output < before, "Pressure protection must retain immediate authority after filtering");
    rig.tick(Mode::FLOW, 30);
    TEST_ASSERT_TRUE(rig.output < gearFlowDuty(10.0f) - 5.0f);
}

static void test_pressure_ramp_reclaims_selector_and_lower_flow_limit_applies() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    for (int i = 1; i <= 400; ++i) {
        rig.pressure = 8.0f + i * 0.005f;
        rig.tick();
        assertFiniteDuty(rig);
        // During this rising ramp, filtered pressure cannot exceed raw pressure
        // and this calibration's flow command is monotone increasing.
        TEST_ASSERT_TRUE(rig.output <= gearFlowDuty(rig.pressure) + 0.03f);
    }
    TEST_ASSERT_TRUE(rig.output < gearFlowDuty(10.0f) - 5.0f);
    rig.flowTarget = 0.5f;
    rig.tick();
    TEST_ASSERT_TRUE(rig.output <= gearFlowDuty(10.0f, 0.5f) + 0.03f);
}

static void test_small_pressure_noise_cannot_recreate_large_output_drop() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    float previous = rig.output;
    for (int i = 0; i < 1000; ++i) {
        rig.pressure = 8.0f + 0.05f * std::sin(i * 2.39996323f);
        rig.tick();
        assertFiniteDuty(rig);
        TEST_ASSERT_TRUE(rig.output > 60.0f);
        TEST_ASSERT_TRUE(std::fabs(rig.output - previous) < 2.0f);
        previous = rig.output;
    }
}

static void test_upper_combined_saturation_preserves_legacy_limits_and_release() {
    Rig rig(1.0f);
    rig.flowTarget = 1000.0f;
    rig.tick(Mode::PRESSURE, 1000);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 100.0f, rig.output);
    rig.pressure = 9.0f;
    rig.tick(Mode::PRESSURE, 100);
    assertFiniteDuty(rig);
    TEST_ASSERT_TRUE(rig.output < 50.0f);
}

static void test_lower_combined_saturation_preserves_legacy_limits_and_eventual_release() {
    Rig rig(10.0f);
    rig.flowTarget = 1000.0f;
    rig.tick(Mode::PRESSURE, 1000);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, rig.output);
    rig.pressure = 8.0f;
    rig.tick(Mode::PRESSURE, 100);
    assertFiniteDuty(rig);
    // This experimental patch isolates the selector reset. Legacy saturation
    // anti-windup remains unchanged, including its delayed lower release.
    rig.tick(Mode::PRESSURE, 900);
    assertFiniteDuty(rig);
    TEST_ASSERT_TRUE_MESSAGE(rig.output > 20.0f, "Legacy saturated pressure control must eventually recover");
}

static void test_flow_command_saturates_at_both_output_endpoints() {
    Rig rig;
    rig.pressureTarget = 0.0f;
    rig.flowTarget = 1000.0f;
    rig.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 100.0f, rig.output);
    rig.flowTarget = 0.0f;
    rig.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, rig.output);
    rig.flowTarget = -1.0f;
    rig.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, rig.output);
}

static void test_zero_and_tiny_integral_gain_remain_finite() {
    for (float gain : {0.0f, 1e-12f}) {
        // At 4 bar the flow branch wins even without integral authority, so
        // this actually exercises the tracking path and its Ki=0 guard.
        Rig rig(4.0f, true, gain);
        rig.flowTarget = 2.4f;
        for (int i = 0; i < 1000; ++i) {
            rig.pressure = 4.0f + 0.1f * std::sin(i * 0.017f);
            rig.tick();
            assertFiniteDuty(rig);
            TEST_ASSERT_TRUE(rig.output <= gearFlowDuty(4.2f) + 0.03f);
        }
        // The tracked bias, rather than division by Ki, preserves the useful
        // command contribution even when integration is disabled.
    }
}

static void test_tracked_flow_bias_survives_integral_gain_changes() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    const float selectedDuty = rig.output;
    for (float gain : {0.0f, 1e-12f, 0.1f, 0.06f}) {
        rig.controller.setGains(0.09f, 1.8f, gain);
        for (int i = 0; i < 1000; ++i) {
            rig.tick();
            assertFiniteDuty(rig);
            TEST_ASSERT_FLOAT_WITHIN(0.02f, selectedDuty, rig.output);
        }
    }
}

static void test_combined_hundred_percent_tie_releases_after_saturation() {
    Rig rig(1.0f);
    rig.flowTarget = 1000.0f;
    for (int i = 0; i < 1000; ++i) {
        rig.tick();
        assertFiniteDuty(rig);
        // Flow's clamped 100% ties pressure's clamped 100%, although the
        // unconstrained pressure candidate exceeds 100%. The experimental
        // patch preserves legacy saturation behavior in this tied selection.
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 100.0f, rig.output);
    }
    rig.pressure = 9.0f;
    rig.tick(Mode::FLOW, 100);
    assertFiniteDuty(rig);
    TEST_ASSERT_TRUE(rig.output < 50.0f);
}

static void test_zero_geometric_flow_is_finite_and_outputs_zero() {
    Rig rig;
    rig.controller.setPumpFlowPolyCoeffs(0.0f, 0.0f, 0.0f, 0.0f);
    rig.controller.setPumpSlipPolyCoeffs(0.0f, 0.0f, 0.0f, 0.0f);
    rig.flowTarget = 2.4f;
    for (int i = 0; i < 100; ++i) {
        rig.tick();
        assertFiniteDuty(rig);
        TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, rig.output);
    }
}

static void test_pure_pressure_unsaturated_behavior_matches_unpatched_nightly() {
    const float offsets[] = {0.0f, 0.0f, 0.0f, 0.1f, 0.2f, 0.3f, 0.2f, 0.1f, 0.0f, -0.1f, -0.2f, -0.1f};
    // Generated from upstream 510ad2e4 sources with the same public
    // warmup, coefficients and pressure trajectory. Neither trace saturates.
    const float expected[2][12] = {{13.89216900f, 14.27788258f, 14.66359806f, 14.62140560f, 14.21728897f, 13.50354290f,
                                    13.53237152f, 13.90312290f, 14.60508442f, 15.77424431f, 17.23174667f, 18.08770180f},
                                   {18.61046028f, 18.85591507f, 19.10136795f, 18.96776581f, 18.50566864f, 17.74929047f,
                                    17.54037666f, 17.80434608f, 18.46184158f, 19.43587112f, 20.65517998f, 21.32081032f}};
    for (int variant = 0; variant < 2; ++variant) {
        const float basePressure = variant == 0 ? 8.0f : 4.0f;
        Rig rig(basePressure);
        rig.pressureTarget = variant == 0 ? 9.0f : 5.0f;
        rig.controller.initSetpointFilter(rig.pressureTarget);
        for (int i = 0; i < 12; ++i) {
            rig.pressure = basePressure + offsets[i];
            rig.tick(Mode::PRESSURE);
            TEST_ASSERT_FLOAT_WITHIN(0.002f, expected[variant][i], rig.output);
        }
    }
}

static void test_stop_alone_removes_previous_flow_bias() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    rig.pressureTarget = 0.0f;
    rig.flowTarget = 0.0f;
    rig.tick(Mode::PRESSURE);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, rig.output);
    rig.pressureTarget = 9.0f;
    rig.controller.initSetpointFilter(9.0f);
    rig.tick(Mode::PRESSURE);
    TEST_ASSERT_FLOAT_WITHIN(0.02f, 13.89215565f, rig.output);
}

static void test_reset_alone_removes_previous_flow_bias() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    rig.controller.reset();
    // No preceding zero-pressure command: this directly tests reset's own
    // clearing of the tracked bias and pressure integral.
    rig.flowTarget = 0.0f;
    rig.controller.initSetpointFilter(9.0f);
    rig.tick(Mode::PRESSURE);
    TEST_ASSERT_FLOAT_WITHIN(0.02f, 13.89215565f, rig.output);
}

static void test_synthetic_restriction_change_preserves_pressure_authority() {
    // Assumed plant: C*dP/dt = Qin - k*sqrt(P), C=1.4 ml/bar,
    // affine nominal pump curve, k=.9 -> .2 -> .9 every 30 seconds.
    // No OPV, no real shot replay and no thermal/headspace model. Overshoot is
    // allowed: filtered feedback cannot guarantee an exact hydraulic ceiling.
    Rig rig(7.11111f);
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    float peak = rig.pressure;
    float restrictivePressure = 0.0f;
    float restrictiveDuty = 0.0f;
    for (int i = 0; i < 3000; ++i) {
        rig.tick();
        assertFiniteDuty(rig);
        const float conductance = i >= 1000 && i < 2000 ? 0.2f : 0.9f;
        const float pumpFlow =
            std::max(0.0f, rig.output / 100.0f * (fullDriveFlow(rig.pressure) + slip(rig.pressure)) - slip(rig.pressure));
        rig.pressure = std::max(0.0f, rig.pressure + dt * (pumpFlow - conductance * std::sqrt(rig.pressure)) / 1.4f);
        peak = std::max(peak, rig.pressure);
        if (i == 1999) {
            restrictivePressure = rig.pressure;
            restrictiveDuty = rig.output;
        }
    }
    TEST_ASSERT_TRUE(peak < 9.7f);
    TEST_ASSERT_FLOAT_WITHIN(0.25f, 9.0f, restrictivePressure);
    TEST_ASSERT_TRUE(restrictiveDuty < gearFlowDuty(9.0f) - 5.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.3f, 7.11111f, rig.pressure);
    TEST_ASSERT_FLOAT_WITHIN(0.03f, gearFlowDuty(rig.pressure), rig.output);
}

static void test_handoff_with_irregular_elapsed_and_intermittent_pressure_samples() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick();
    const float selectedDuty = rig.output;
    const float intervals[] = {0.012f, 0.017f, 0.031f, 0.008f, 0.020f};
    for (int i = 0; i < 1000; ++i) {
        // Fixed physical pressure isolates handoff state from plant dynamics.
        // Sensor samples arrive less often than control ticks, as in the new API.
        rig.controller.update(Mode::FLOW, i % 3 == 0, 0.060f, intervals[i % 5]);
        assertFiniteDuty(rig);
        TEST_ASSERT_FLOAT_WITHIN(0.02f, selectedDuty, rig.output);
    }
}

static void test_stale_pressure_is_ignored_until_a_fresh_sample_can_limit_output() {
    Rig rig;
    rig.buildPressureDuty();
    rig.flowTarget = 2.4f;
    rig.tick(Mode::FLOW, 100);
    const float before = rig.output;
    rig.pressure = 10.0f;
    rig.controller.update(Mode::FLOW, false, 0.0f, 0.020f);
    TEST_ASSERT_FLOAT_WITHIN(0.02f, before, rig.output);
    rig.controller.update(Mode::FLOW, true, 0.060f, 0.020f);
    TEST_ASSERT_TRUE_MESSAGE(rig.output < before, "Fresh pressure feedback must still reduce the selected output");
}

static void test_pressure_integration_uses_actual_elapsed_between_control_ticks() {
    Rig rig;
    rig.controller.update(Mode::PRESSURE, false, 0.0f, 0.015f);
    const float first = rig.output;
    rig.controller.update(Mode::PRESSURE, false, 0.0f, 0.045f);
    const float expectedIncrement = 100.0f * (0.06f / (1.0f - 8.0f / 15.0f)) * 0.045f;
    TEST_ASSERT_FLOAT_WITHIN(0.002f, expectedIncrement, rig.output - first);
}

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_gear_flow_handoff_has_no_next_cycle_collapse);
    RUN_TEST(test_default_no_slip_model_also_has_bumpless_handoff);
    RUN_TEST(test_low_pressure_case_keeps_flow_without_collapse);
    RUN_TEST(test_flow_control_remains_stable_for_one_thousand_ticks);
    RUN_TEST(test_mode_labels_do_not_disrupt_a_combined_selector);
    RUN_TEST(test_pressure_increase_can_reduce_duty_on_first_filtered_sample);
    RUN_TEST(test_pressure_ramp_reclaims_selector_and_lower_flow_limit_applies);
    RUN_TEST(test_small_pressure_noise_cannot_recreate_large_output_drop);
    RUN_TEST(test_upper_combined_saturation_preserves_legacy_limits_and_release);
    RUN_TEST(test_lower_combined_saturation_preserves_legacy_limits_and_eventual_release);
    RUN_TEST(test_flow_command_saturates_at_both_output_endpoints);
    RUN_TEST(test_zero_and_tiny_integral_gain_remain_finite);
    RUN_TEST(test_tracked_flow_bias_survives_integral_gain_changes);
    RUN_TEST(test_combined_hundred_percent_tie_releases_after_saturation);
    RUN_TEST(test_zero_geometric_flow_is_finite_and_outputs_zero);
    RUN_TEST(test_pure_pressure_unsaturated_behavior_matches_unpatched_nightly);
    RUN_TEST(test_stop_alone_removes_previous_flow_bias);
    RUN_TEST(test_reset_alone_removes_previous_flow_bias);
    RUN_TEST(test_synthetic_restriction_change_preserves_pressure_authority);
    RUN_TEST(test_handoff_with_irregular_elapsed_and_intermittent_pressure_samples);
    RUN_TEST(test_stale_pressure_is_ignored_until_a_fresh_sample_can_limit_output);
    RUN_TEST(test_pressure_integration_uses_actual_elapsed_between_control_ticks);
    return UNITY_END();
}
