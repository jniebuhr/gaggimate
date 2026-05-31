// Unit tests: Autotune SIMC integrator+lag rule + exp-peeling τ₂ identifier.
// Host-side, no ESP32/Arduino runtime — pio test -e native_autotune.
//
// Groups:
//   A — SIMC rule math
//   B — τ₂ recovery on synthetic integrator+lag step responses
//   C — shot replay integration (skipped here)

#include <unity.h>

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

// Direct-include Autotune TU — native harness skips NayrodPID's
// Arduino-dependent siblings (SimplePID, SimpleKalmanFilter,
// PressureController). Standard unity-test pattern for mixed-runtime libs.
#include "Autotune/Autotune.cpp"

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

// Drive autotuner with synthetic integrator+lag step:
//   y(t) = 0                                       for t < L
//   y(t) = k' · [(t-L) - τ₂·(1 - e^{-(t-L)/τ₂})]   for t >= L
// Temp = integral of slope; boiler starts at 20 °C.
//
// dt_sec = sample period (1.0 s matches NayrodPID real loop)
// total_sec = simulated test length
// noise_amp = uniform ±noise_amp/sample (MAX31855 LSB ≈ 0.25 °C)
static void drive_synthetic(Autotune &at, float L, float k_prime, float tau2,
                            float dt_sec = 1.0f, float total_sec = 180.0f,
                            float noise_amp = 0.0f) {
    const float t0 = 20.0f; // starting temperature
    // Integer counter + derived `t` avoids float accumulation drift on long
    // runs (Sonar cpp:S2193 — counters not float).
    const int total_steps = static_cast<int>(total_sec / dt_sec) + 1;
    uint32_t seed = 1u; // LCG, deterministic noise — unsigned avoids signed-overflow UB
    for (int step = 0; step <= total_steps; ++step) {
        const float t = static_cast<float>(step) * dt_sec;
        float temp;
        if (t < L) {
            temp = t0;
        } else {
            const float dt_from_L = t - L;
            const float ramp = dt_from_L - tau2 * (1.0f - std::exp(-dt_from_L / tau2));
            temp = t0 + k_prime * ramp;
        }
        if (noise_amp > 0.0f) {
            seed = seed * 1103515245u + 12345u;
            const float r01 = static_cast<float>((seed >> 16) & 0x7fff) / 32767.0f;
            temp += (r01 * 2.0f - 1.0f) * noise_amp;
            // Quantise to MAX31855 LSB (0.25 °C) — match real hardware signal.
            temp = std::round(temp / 0.25f) * 0.25f;
        }
        at.update(temp, t);
        if (at.isFinished()) break;
    }
}

// ---------------------------------------------------------------------------
// Group A — SIMC integrator+lag rule math
// ---------------------------------------------------------------------------

// Representative espresso-boiler FOPDT values (L=17 s, k'=0.188 °C/s,
// τ₂=3.5 s). Expected gains after Heater ×1000 scale ≈ 110/0.65/385 — within
// 25 % of known-working hand tune on this plant class.
static void test_simc_boiler_typical() {
    Autotune at;
    // Drive via update() so rule runs same codepath as production.
    drive_synthetic(at, /*L=*/17.17f, /*k_prime=*/0.188f, /*tau2=*/3.5f,
                    /*dt=*/1.0f, /*total=*/180.0f);
    TEST_ASSERT_TRUE_MESSAGE(at.isFinished(), "autotuner should finish within 180 s");
    TEST_ASSERT_FALSE_MESSAGE(at.isTimedOut(), "autotuner should not time out");
    const float Kp = at.getKp() * 1000.0f;
    const float Ki = at.getKi() * 1000.0f;
    const float Kd = at.getKd() * 1000.0f;
    // Envelope absorbs τ₂ estimation noise on synthetic data (±25 %).
    // SIMC integrator+lag: Kc=1/(k'(τc+L))·1000, Ti=4(τc+L), Td=τ₂, τc=1.5·L.
    TEST_ASSERT_FLOAT_WITHIN_MESSAGE(30.0f, 112.3f, Kp, "Kp within 25 %");
    TEST_ASSERT_FLOAT_WITHIN_MESSAGE(0.20f, 0.658f, Ki, "Ki within ~30 %");
    TEST_ASSERT_FLOAT_WITHIN_MESSAGE(200.0f, 400.0f, Kd, "Kd within 50 %");
}

// Clamp guard: degenerate inputs → zero gains, not NaN/Inf. update() with
// zero-slope plant → timeout path → gains stay reset-default zero.
static void test_simc_clamp_guard_zero_slope() {
    Autotune at;
    // Plant never moves. Integer counter (Sonar cpp:S2193) drives 1 Hz.
    for (int step = 0; step <= 130; ++step) {
        at.update(20.0f, static_cast<float>(step));
    }
    TEST_ASSERT_TRUE_MESSAGE(at.isTimedOut(), "flat plant should trip timeout");
    TEST_ASSERT_TRUE_MESSAGE(at.isFinished(), "timeout also marks finished");
    // Gains zero (reset-initialised, never computed).
    TEST_ASSERT_EQUAL_FLOAT(0.0f, at.getKp());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, at.getKd());
    // No NaN/Inf leak.
    TEST_ASSERT_TRUE(std::isfinite(at.getKp()));
    TEST_ASSERT_TRUE(std::isfinite(at.getKi()));
    TEST_ASSERT_TRUE(std::isfinite(at.getKd()));
}

// ---------------------------------------------------------------------------
// Group B — area-moments τ₂ identifier
// ---------------------------------------------------------------------------

// Synthetic integrator+lag with known τ₂; identifier recovers within
// ±20 % (research target).
static void check_tau2_recovery(float L, float k_prime, float tau2_truth,
                                float tol_pct, float noise_amp = 0.0f) {
    Autotune at;
    drive_synthetic(at, L, k_prime, tau2_truth, 1.0f, 300.0f, noise_amp);
    TEST_ASSERT_TRUE(at.isFinished());
    TEST_ASSERT_FALSE(at.isTimedOut());
    const float tau2_est = at.getSystemTau2();
    const float pct_err = std::abs(tau2_est - tau2_truth) / tau2_truth * 100.0f;
    // std::string + snprintf-into-buffer sidesteps Sonar cpp:S5945 (no
    // C-style char arrays); Unity MESSAGE macros still need C-string.
    std::string msg(96, '\0');
    const int written = std::snprintf(msg.data(), msg.size(),
                                      "τ₂ truth=%.2f est=%.2f err=%.1f%%",
                                      tau2_truth, tau2_est, pct_err);
    if (written > 0) msg.resize(static_cast<std::string::size_type>(written));
    TEST_ASSERT_LESS_OR_EQUAL_MESSAGE(tol_pct, pct_err, msg.c_str());
}

static void test_tau2_recovery_noiseless() {
    // Short parasitic lag — thermocouple clamped to metal boiler shell.
    check_tau2_recovery(17.17f, 0.188f, 3.5f, /*tol=*/30.0f);
    // Longer parasitic lag — still identifiable via exp peeling.
    check_tau2_recovery(15.0f, 0.20f, 10.0f, /*tol=*/30.0f);
}

static void test_tau2_recovery_with_quantisation() {
    // MAX31855 0.25 °C LSB. Verify quantisation robustness.
    check_tau2_recovery(17.17f, 0.188f, 3.5f, /*tol=*/40.0f, /*noise=*/0.25f);
}

// ---------------------------------------------------------------------------
// Unity entrypoint
// ---------------------------------------------------------------------------

// Unity fixture hooks — required by framework. Each test owns its local
// Autotune; no framework-level setup/teardown.
void setUp(void) { /* no framework-level setup needed */ }
void tearDown(void) { /* no framework-level teardown needed */ }

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_simc_boiler_typical);
    RUN_TEST(test_simc_clamp_guard_zero_slope);
    RUN_TEST(test_tau2_recovery_noiseless);
    RUN_TEST(test_tau2_recovery_with_quantisation);
    return UNITY_END();
}
