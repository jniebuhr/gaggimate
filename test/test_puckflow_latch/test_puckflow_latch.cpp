// Unit tests: PressureController puck-flow/puck-resistance estimator arming
// across successive shots in one power session (GH #839).
// Host-side, no ESP32/Arduino/BLE runtime — pio test -e native -f test_puckflow_latch.

#include <unity.h>

#include <cmath>
#include <cstdio>

// PressureController.cpp's only non-STL dependency is one ESP_LOGI() call
// in reset() (an ESP-IDF logging macro); no-op it for the native build — it
// doesn't affect the estimator math under test. SimpleKalmanFilter has no
// Arduino/ESP-IDF dependency at all, so both TUs compile natively as-is.
#define ESP_LOGI(tag, fmt, ...) ((void)0)

#include "SimpleKalmanFilter/SimpleKalmanFilter.cpp"
#include "PressureController/PressureController.cpp"

// ---------------------------------------------------------------------------
// Test fixture: drives PressureController through synthetic brew shots
// (pressure ramp -> hold -> rapid drop at brew-off), matching the pressure
// trace shape the estimator's own arming comment describes (virtualScale()
// puck-state machine in PressureController.cpp). Only the public API
// (getPuckResistance()/getCoffeeFlowRate()) is used for assertions, no
// private-state access.
// ---------------------------------------------------------------------------

struct ShotRig {
    static constexpr float kDt = 0.03f; // matches DimmedPump's real 30 ms loop task
    static constexpr float kHoldBar = 9.0f;
    static constexpr float kRampSec = 3.0f;
    static constexpr float kHoldSec = 3.0f; // brew window tuned so a clean shot arms
                                            // comfortably within it but a shot that
                                            // inherits the previous shot's un-reset
                                            // filter state (the #839 bug) does not
    static constexpr float kDropSec = 0.5f;

    float rawPressureSetpoint = 0.0f;
    float rawFlowSetpoint = 0.0f; // pressure-only control mode
    float rawPressure = 0.0f;
    float controllerOutput = 0.0f;
    int valveStatus = 0;
    PressureController controller;

    ShotRig()
        : controller(kDt, &rawPressureSetpoint, &rawFlowSetpoint, &rawPressure, &controllerOutput, &valveStatus) {
        controller.setPumpFlowPolyCoeffs(0.0f, 0.0f, -0.5854f, 10.79f); // repo default coeffs
    }

    void tick() { controller.update(PressureController::ControlMode::PRESSURE); }

    // Ramps pressure 0 -> kHoldBar then holds it, i.e. the shape of an actual
    // brew's pressure trace while water is flowing through the puck. Returns
    // whether the estimator armed (public API only) before the shot ends —
    // this is the window where a real machine would report nonzero pf/pr.
    bool runBrewWindow() {
        rawPressureSetpoint = kHoldBar;
        valveStatus = 1;

        const int rampSteps = static_cast<int>(kRampSec / kDt);
        for (int i = 0; i < rampSteps; ++i) {
            rawPressure = kHoldBar * (static_cast<float>(i) / static_cast<float>(rampSteps));
            tick();
        }

        const int holdSteps = static_cast<int>(kHoldSec / kDt);
        for (int i = 0; i < holdSteps; ++i) {
            rawPressure = kHoldBar;
            tick();
        }

        return std::isfinite(controller.getPuckResistance()) && controller.getCoffeeFlowRate() > 0.0f;
    }

    // End-of-brew depressurization: pressure drops rapidly back to 0 as the
    // group valve closes. This is what leaves a residual in the un-reset
    // IIR-filtered accumulators (_filteredPressureDerivative,
    // _waterThroughPuckFlowRate) ahead of the fix.
    void endShot() {
        const int dropSteps = static_cast<int>(kDropSec / kDt);
        for (int i = 0; i < dropSteps; ++i) {
            rawPressure = kHoldBar * (1.0f - static_cast<float>(i + 1) / static_cast<float>(dropSteps));
            tick();
        }
        rawPressure = 0.0f;
        rawPressureSetpoint = 0.0f;
        valveStatus = 0;
        tick();
    }

    // Mirrors DimmedPump::tare(): both calls run on every BLE tare trigger
    // (start of brew/flush/water) — see
    // lib/GaggiMateController/src/peripherals/DimmedPump.cpp.
    void tareBetweenShots() {
        controller.tare();
        controller.reset();
    }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// A single shot on a freshly-constructed controller arms the puck-flow
// estimator within its own brew window.
static void test_first_shot_arms_estimator() {
    ShotRig rig;
    TEST_ASSERT_TRUE_MESSAGE(rig.runBrewWindow(), "puck-flow estimator should arm during the first shot's brew window");
}

// GH #839: a second shot, separated from the first only by the BLE tare()
// the display sends at brew start, should also arm within its own brew
// window. Before the fix, tare()/reset() clear the puck-state machine but
// leave _filteredPressureDerivative and _waterThroughPuckFlowRate
// un-reset, so the first shot's end-of-brew depressurization transient leaks
// into the second shot and suppresses the puck-conductance-derivative
// signature the state machine arms on — reproducing the "pf/pr zero on shots
// after the first" symptom from #839.
static void test_second_shot_arms_estimator_after_tare() {
    ShotRig rig;
    TEST_ASSERT_TRUE(rig.runBrewWindow());
    rig.endShot();
    rig.tareBetweenShots();

    TEST_ASSERT_TRUE_MESSAGE(rig.runBrewWindow(),
                             "puck-flow estimator should also arm during the second shot's brew window "
                             "(GH #839: un-reset filter state from the first shot suppresses arming)");
}

// ---------------------------------------------------------------------------
// Unity entrypoint
// ---------------------------------------------------------------------------

void setUp(void) { /* No shared fixture state. */ }
void tearDown(void) { /* No shared fixture state. */ }

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_first_shot_arms_estimator);
    RUN_TEST(test_second_shot_arms_estimator_after_tare);
    return UNITY_END();
}
