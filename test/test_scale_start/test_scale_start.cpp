#include <display/core/ScaleStartGate.h>
#include <unity.h>
static unsigned long nowMillis = 0;
unsigned long millis() { return nowMillis; }
#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
#include <display/core/process/GrindProcess.h>
void setUp() {}
void tearDown() {}
using Result = ScaleStartGate::Result;
void waits_for_a_fresh_zero_after_tare() {
    ScaleStartGate gate;
    gate.begin(100);
    gate.observe(0, 150, 200, false, true, 100);
    TEST_ASSERT_TRUE(gate.poll(200, true, false, true) == Result::Waiting);
    gate.observe(0, 199, 200, true, true, 200); // sample predates completion
    TEST_ASSERT_TRUE(gate.poll(200, true, true, true) == Result::Waiting);
    gate.observe(40, 250, 250, true, true, 200);
    TEST_ASSERT_TRUE(gate.poll(250, true, true, true) == Result::Waiting);
    gate.observe(0.1, 300, 300, true, true, 200);
    TEST_ASSERT_TRUE(gate.poll(300, true, true, true) == Result::Ready);
}
void refuses_stale_zero_failed_write_and_disconnect() {
    ScaleStartGate gate;
    gate.begin(100);
    gate.observe(0, 200, 1800, true, true, 150);
    TEST_ASSERT_TRUE(gate.poll(1800, true, true, true) == Result::Waiting);
    TEST_ASSERT_TRUE(gate.poll(2000, false, true, true) == Result::Failed);
    TEST_ASSERT_TRUE(gate.poll(2000, true, true, false) == Result::Failed);
    TEST_ASSERT_TRUE(gate.poll(2600, true, false, false) == Result::Failed);
}
void reset_and_clock_wrap_do_not_release_an_old_start() {
    ScaleStartGate gate;
    gate.begin(UINT32_MAX - 100);
    gate.observe(0, 10, 20, true, true, UINT32_MAX - 10);
    TEST_ASSERT_TRUE(gate.poll(20, true, true, true) == Result::Ready);
    gate.begin(30);
    TEST_ASSERT_TRUE(gate.poll(40, true, false, false) == Result::Waiting);
    TEST_ASSERT_TRUE(gate.poll(2530, true, false, false) == Result::Failed);
}
void stopped_grind_does_not_restart_during_post_processing() {
    nowMillis = 100;
    GrindProcess timed(ProcessTarget::TIME, 5000);
    GrindProcess weighted(ProcessTarget::VOLUMETRIC, 0, 18);
    timed.active = weighted.active = false;
    nowMillis = 200;
    timed.progress();
    weighted.progress();
    TEST_ASSERT_FALSE(timed.isActive());
    TEST_ASSERT_FALSE(weighted.isActive());
    TEST_ASSERT_FALSE(timed.isAltRelayActive());
    TEST_ASSERT_FALSE(weighted.isAltRelayActive());
}
void timed_grind_records_when_it_finishes() {
    nowMillis = 100;
    GrindProcess timed(ProcessTarget::TIME, 500);
    nowMillis = 601;
    timed.progress();
    TEST_ASSERT_FALSE(timed.isActive());
    TEST_ASSERT_EQUAL_UINT32(601, timed.finished);
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(waits_for_a_fresh_zero_after_tare);
    RUN_TEST(refuses_stale_zero_failed_write_and_disconnect);
    RUN_TEST(reset_and_clock_wrap_do_not_release_an_old_start);
    RUN_TEST(stopped_grind_does_not_restart_during_post_processing);
    RUN_TEST(timed_grind_records_when_it_finishes);
    return UNITY_END();
}
