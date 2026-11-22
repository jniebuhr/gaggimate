// SimplePID update cadence follows its sampling frequency: pio test -e native -f test_simple_pid_rate.

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <unity.h>

static uint32_t fakeNow = 0;
static uint32_t millis() { return fakeNow; }
#ifndef PI
#define PI 3.14159265358979f
#endif
#define ESP_LOGV(...)
template <typename T> static T constrain(T v, T lo, T hi) { return std::min(std::max(v, lo), hi); }

#include "SimplePID/SimplePID.cpp"

void setUp() { fakeNow = 0; }
void tearDown() {}

// Counts the updates SimplePID accepts over `ms` milliseconds polled every 10 ms, like Heater::loop.
static int updatesIn(float frequencyHz, uint32_t ms) {
    float output = 0.0f, sensor = 90.0f, setpoint = 93.0f;
    SimplePID pid(&output, &sensor, &setpoint);
    pid.setSamplingFrequency(frequencyHz);
    pid.setCtrlOutputLimits(0.0f, 1000.0f);
    pid.setControllerPIDGains(10.0f, 0.1f, 0.0f, 0.0f);
    pid.setMode(SimplePID::Control::automatic);
    fakeNow = 100000;
    pid.update();
    int updates = 0;
    for (uint32_t t = 10; t <= ms; t += 10) {
        fakeNow = 100000 + t;
        if (pid.update())
            updates++;
    }
    return updates;
}

static void test_one_hertz_updates_every_second() { TEST_ASSERT_EQUAL(10, updatesIn(1.0f, 10000)); }

static void test_four_hertz_updates_every_quarter_second() { TEST_ASSERT_EQUAL(40, updatesIn(4.0f, 10000)); }

static void test_half_hertz_updates_every_two_seconds() { TEST_ASSERT_EQUAL(5, updatesIn(0.5f, 10000)); }

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_one_hertz_updates_every_second);
    RUN_TEST(test_four_hertz_updates_every_quarter_second);
    RUN_TEST(test_half_hertz_updates_every_two_seconds);
    return UNITY_END();
}
