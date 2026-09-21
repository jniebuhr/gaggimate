#include <unity.h>

#include <cmath>
#include <string>

#include "display/core/pid_feedforward.cpp"

namespace {
// Mirrors Settings::setPid: autotune formats a string, then the stored PID
// keeps a missing Kff. The resulting 4th field is what setPidSettings sends
// to Heater::setFeedforwardScale.
std::string storePid(const std::string &existing, float kp, float ki, float kd, float kf, bool &skipped) {
    return mergePidKeepingFeedforward(existing, formatAutotunePid(kp, ki, kd, kf, skipped));
}

void test_autotune_with_wattage_keeps_kff_across_pid_only_save() {
    bool skipped = true;
    const float kff = 1000.0f / 1360.0f;
    const std::string tuned = storePid("58.397,1.027,249.055,0.0", 32.339f, 0.539f, 124.046f, kff, skipped);
    TEST_ASSERT_FALSE(skipped);
    TEST_ASSERT_EQUAL_STRING("32.339,0.539,124.046,0.735", tuned.c_str());

    const std::string saved = mergePidKeepingFeedforward(tuned, "36.0,1.3,124.046");
    TEST_ASSERT_EQUAL_STRING("36.0,1.3,124.046,0.735", saved.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001f, kff, pidFeedforwardGain(saved));
}

void test_blank_or_trailing_kff_keeps_stored_value_explicit_zero_clears_it() {
    const std::string existing = "36.0,1.3,124.046,0.735";
    TEST_ASSERT_EQUAL_STRING("40,2,100,0.735", mergePidKeepingFeedforward(existing, "40,2,100,").c_str());
    TEST_ASSERT_EQUAL_STRING("40,2,100,0", mergePidKeepingFeedforward(existing, "40,2,100,0").c_str());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, pidFeedforwardGain(mergePidKeepingFeedforward(existing, "40,2,100,0.000")));
}

void test_autotune_without_wattage_keeps_previous_kff() {
    bool skipped = false;
    const std::string existing = "36.000,1.300,124.046,0.735";
    const std::string stored = storePid(existing, 32.339f, 0.539f, 124.046f, 0.0f, skipped);
    TEST_ASSERT_TRUE(skipped);
    TEST_ASSERT_EQUAL_STRING("32.339,0.539,124.046,0.735", stored.c_str());
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.735f, pidFeedforwardGain(stored));
}
} // namespace

void setUp(void) {}
void tearDown(void) {}

int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    UNITY_BEGIN();
    RUN_TEST(test_autotune_with_wattage_keeps_kff_across_pid_only_save);
    RUN_TEST(test_blank_or_trailing_kff_keeps_stored_value_explicit_zero_clears_it);
    RUN_TEST(test_autotune_without_wattage_keeps_previous_kff);
    return UNITY_END();
}
