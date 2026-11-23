// Unit tests: lag compensation setting limits shared by the display and the controller.
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_lag_limits.

#include <unity.h>

#include <array>
#include <cmath>
#include <limits>

#include "LagCompensationLimits.h"

using namespace lag_limits;

void setUp() { /* no shared fixture state */ }
void tearDown() { /* no shared fixture state */ }

void test_off_values_become_zero() {
    TEST_ASSERT_EQUAL_FLOAT(0.0f, clampOrOff(0.0f, SENSOR_DEAD_TIME_S));
    TEST_ASSERT_EQUAL_FLOAT(0.0f, clampOrOff(-5.0f, SENSOR_DEAD_TIME_S));
    TEST_ASSERT_EQUAL_FLOAT(0.0f, clampOrOff(NAN, SENSOR_DEAD_TIME_S)); // "nan" from the web form
    TEST_ASSERT_EQUAL_FLOAT(0.0f, clampOrOff(std::numeric_limits<float>::infinity(), SENSOR_DEAD_TIME_S));
}

void test_values_clamp_into_range() {
    TEST_ASSERT_EQUAL_FLOAT(2.0f, clampOrOff(0.1f, SENSOR_DEAD_TIME_S));
    TEST_ASSERT_EQUAL_FLOAT(20.0f, clampOrOff(20.0f, SENSOR_DEAD_TIME_S));
    // A huge dead time would overflow the integral-pause milliseconds and grow the predictor window without bound.
    TEST_ASSERT_EQUAL_FLOAT(60.0f, clampOrOff(1e9f, SENSOR_DEAD_TIME_S));
    TEST_ASSERT_EQUAL_FLOAT(2500.0f, clampOrOff(1e6f, HEATER_W));
    TEST_ASSERT_EQUAL_FLOAT(0.05f, clampOrOff(1e-6f, HEAT_RATE_C_PER_S));
}

// The ranges must stay usable for a Rancilio Silvia (the values on the bench) and internally consistent.
void test_ranges_are_sane() {
    const std::array<Range, 7> ranges = {DERIVATIVE_FILTER_S, INTEGRAL_ZONE_C, SENSOR_DEAD_TIME_S, WATER_DEAD_TIME_S, HEATER_W,
                                         HEAT_RATE_C_PER_S,   VALVE_DUMP_ML};
    for (const Range &r : ranges) {
        TEST_ASSERT_TRUE(r.min > 0.0f);
        TEST_ASSERT_TRUE(r.max > r.min);
    }
    TEST_ASSERT_EQUAL_FLOAT(0.0f, STANDING_LOSS_W.min);
    TEST_ASSERT_EQUAL_FLOAT(2.0f, clampOrOff(2.0f, DERIVATIVE_FILTER_S));
    TEST_ASSERT_EQUAL_FLOAT(1.5f, clampOrOff(1.5f, INTEGRAL_ZONE_C));
    TEST_ASSERT_EQUAL_FLOAT(20.0f, clampOrOff(20.0f, SENSOR_DEAD_TIME_S));
    TEST_ASSERT_EQUAL_FLOAT(1100.0f, clampOrOff(1100.0f, HEATER_W));
    TEST_ASSERT_EQUAL_FLOAT(0.6f, clampOrOff(0.6f, HEAT_RATE_C_PER_S));
    TEST_ASSERT_EQUAL_FLOAT(52.0f, clampOrOff(52.0f, STANDING_LOSS_W));
    TEST_ASSERT_EQUAL_FLOAT(5.0f, clampOrOff(5.0f, VALVE_DUMP_ML)); // weighed on a Silvia
    TEST_ASSERT_EQUAL_FLOAT(12.0f, clampOrOff(12.0f, WATER_DEAD_TIME_S));
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_off_values_become_zero);
    RUN_TEST(test_values_clamp_into_range);
    RUN_TEST(test_ranges_are_sane);
    return UNITY_END();
}
