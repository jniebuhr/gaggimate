#include <unity.h>

static unsigned long now_ms = 0;
unsigned long millis() { return now_ms; }

#include "display/core/process/LiveBrewProcess.h"

static void test_live_brew_holds_manual_setpoints_until_stop() {
    LiveBrewProcess process(9.0f, 3.0f);
    TEST_ASSERT_TRUE(process.isActive());
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 9.0f, process.getPressureTarget());
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.0f, process.getFlowTarget());
    process.setSetpoints(6.5f, 4.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 6.5f, process.getPressureTarget());
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.0f, process.getFlowTarget());
    process.stop();
    TEST_ASSERT_FALSE(process.isActive());
}

static void test_live_brew_has_firmware_safety_timeout() {
    now_ms = 0;
    LiveBrewProcess process(9.0f, 3.0f);
    now_ms = BREW_SAFETY_DURATION_MS;
    process.progress();
    TEST_ASSERT_FALSE(process.isActive());
}

void setUp(void) {}
void tearDown(void) {}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_live_brew_holds_manual_setpoints_until_stop);
    RUN_TEST(test_live_brew_has_firmware_safety_timeout);
    return UNITY_END();
}
