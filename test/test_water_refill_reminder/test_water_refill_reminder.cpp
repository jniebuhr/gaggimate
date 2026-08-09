#include <unity.h>

#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "display/models/WaterRefillReminder.cpp"

static WaterRefillReminder reminder;

void setUp(void) {
    setenv("TZ", "America/Los_Angeles", 1);
    tzset();
    reminder = WaterRefillReminder();
}
void tearDown(void) { /* Unity hook */ }

static const WaterReminderSnapshot &snapshot() { return reminder.getSnapshot(); }

static void assertSeverity(WaterReminderSeverity severity) {
    TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(severity), static_cast<uint8_t>(reminder.getSeverity()));
}

static void completeDrinks(uint16_t count) {
    for (uint16_t i = 0; i < count; i++) {
        reminder.recordBrew(WaterReminderBrewOutcome::DRINK);
    }
}

static void addCalibrationCycle(float unitsPerDrink, uint16_t drinks = 2) {
    completeDrinks(drinks);
    reminder.addPumpUsage(unitsPerDrink * drinks);
    TEST_ASSERT_TRUE(reminder.refill());
}

static time_t makeLocal(int year, int month, int day, int hour, int minute) {
    tm value{};
    value.tm_year = year - 1900;
    value.tm_mon = month - 1;
    value.tm_mday = day;
    value.tm_hour = hour;
    value.tm_min = minute;
    value.tm_isdst = -1;
    return mktime(&value);
}

static void test_count_only_until_calibrated() {
    reminder.configure(4, 5);
    reminder.addPumpUsage(1000.0f);
    assertSeverity(WaterReminderSeverity::NONE);
    completeDrinks(4);
    assertSeverity(WaterReminderSeverity::WARNING);
    reminder.recordBrew(WaterReminderBrewOutcome::DRINK);
    assertSeverity(WaterReminderSeverity::CRITICAL);
}

static void test_tracking_requires_completed_setup() {
    TEST_ASSERT_TRUE(WaterRefillReminder::canTrack(true, false, false));
    TEST_ASSERT_FALSE(WaterRefillReminder::canTrack(true, false, true));
}

static void test_hardware_sensor_suspends_tracking() {
    TEST_ASSERT_FALSE(WaterRefillReminder::canTrack(true, true, false));
    TEST_ASSERT_FALSE(WaterRefillReminder::canTrack(false, false, false));
}

static void test_only_completed_real_brews_count_as_drinks() {
    reminder.recordBrew(WaterReminderBrewOutcome::ABORTED);
    reminder.recordBrew(WaterReminderBrewOutcome::UTILITY);
    TEST_ASSERT_EQUAL_UINT16(0, snapshot().drinks);

    reminder.recordBrew(WaterReminderBrewOutcome::DRINK);
    TEST_ASSERT_EQUAL_UINT16(1, snapshot().drinks);
}

static void test_pump_usage_can_warn_early() {
    reminder.configure(4, 5);
    addCalibrationCycle(100.0f);
    completeDrinks(2);
    reminder.addPumpUsage(410.0f);
    assertSeverity(WaterReminderSeverity::WARNING);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.1f, reminder.getPumpEquivalentDrinks());
}

static void test_count_warning_has_precedence_over_low_pump_usage() {
    reminder.configure(4, 5);
    addCalibrationCycle(100.0f);
    completeDrinks(5);
    reminder.addPumpUsage(100.0f);
    assertSeverity(WaterReminderSeverity::CRITICAL);
}

static void test_refill_uses_median_of_latest_five_cycles() {
    addCalibrationCycle(100.0f);
    addCalibrationCycle(500.0f);
    addCalibrationCycle(200.0f);
    addCalibrationCycle(300.0f);
    addCalibrationCycle(400.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 300.0f, reminder.getPumpUnitsPerDrink());

    addCalibrationCycle(600.0f);
    TEST_ASSERT_EQUAL_UINT32(5, snapshot().calibrationCount);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 400.0f, reminder.getPumpUnitsPerDrink());
}

static void test_invalid_refill_cycle_does_not_calibrate() {
    reminder.addPumpUsage(100.0f);
    TEST_ASSERT_FALSE(reminder.refill());
    TEST_ASSERT_FALSE(reminder.isCalibrated());

    completeDrinks(2);
    TEST_ASSERT_FALSE(reminder.refill());
    TEST_ASSERT_FALSE(reminder.isCalibrated());
}

static void test_later_rearms_only_when_severity_increases() {
    completeDrinks(4);
    TEST_ASSERT_TRUE(reminder.isWarningPending());
    reminder.acknowledge();
    TEST_ASSERT_FALSE(reminder.isWarningPending());
    reminder.addPumpUsage(100.0f);
    TEST_ASSERT_FALSE(reminder.isWarningPending());

    reminder.recordBrew(WaterReminderBrewOutcome::DRINK);
    TEST_ASSERT_TRUE(reminder.isWarningPending());
    assertSeverity(WaterReminderSeverity::CRITICAL);
}

static void test_refill_resets_usage_and_acknowledgement() {
    completeDrinks(5);
    reminder.addPumpUsage(500.0f);
    reminder.acknowledge();
    TEST_ASSERT_TRUE(reminder.refill());
    TEST_ASSERT_EQUAL_UINT16(0, snapshot().drinks);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, snapshot().pumpUnits);
    TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(WaterReminderSeverity::NONE),
                            static_cast<uint8_t>(snapshot().acknowledgedSeverity));
}

static void test_restore_rejects_invalid_usage_and_samples() {
    WaterReminderSnapshot restored;
    restored.drinks = 3;
    restored.pumpUnits = NAN;
    restored.acknowledgedSeverity = WaterReminderSeverity::WARNING;
    const float samples[]{100.0f, NAN, 300.0f, 0.0f, 0.0f};
    memcpy(restored.calibration, samples, sizeof(samples));
    restored.calibrationCount = WaterReminderSnapshot::MAX_CALIBRATION_SAMPLES;
    reminder.restore(restored);
    TEST_ASSERT_EQUAL_UINT16(3, snapshot().drinks);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, snapshot().pumpUnits);
    TEST_ASSERT_EQUAL_UINT32(1, snapshot().calibrationCount);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 100.0f, reminder.getPumpUnitsPerDrink());
}

static void test_restore_valid_state() {
    WaterReminderSnapshot restored;
    restored.drinks = 3;
    restored.pumpUnits = 750.0f;
    restored.acknowledgedSeverity = WaterReminderSeverity::WARNING;
    restored.calibration[0] = 100.0f;
    restored.calibration[1] = 300.0f;
    restored.calibration[2] = 200.0f;
    restored.calibrationCount = 3;
    reminder.restore(restored);
    TEST_ASSERT_EQUAL_UINT16(3, snapshot().drinks);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 750.0f, snapshot().pumpUnits);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 200.0f, reminder.getPumpUnitsPerDrink());
    TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(WaterReminderSeverity::WARNING),
                            static_cast<uint8_t>(snapshot().acknowledgedSeverity));
}

static void test_reset_calibration_keeps_current_cycle() {
    addCalibrationCycle(100.0f);
    completeDrinks(2);
    reminder.addPumpUsage(250.0f);
    reminder.resetCalibration();
    TEST_ASSERT_FALSE(reminder.isCalibrated());
    TEST_ASSERT_EQUAL_UINT16(2, snapshot().drinks);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 250.0f, snapshot().pumpUnits);
}

static void test_schedule_uses_local_calendar_days_across_dst() {
    reminder.configureSchedule(2, 20 * 60);
    const time_t refill = makeLocal(2026, 3, 7, 21, 0);
    reminder.initialize(WaterReminderMode::SCHEDULE, refill);

    const time_t due = reminder.getNextReminderAt();
    tm local{};
    localtime_r(&due, &local);
    TEST_ASSERT_EQUAL_INT(9, local.tm_mday);
    TEST_ASSERT_EQUAL_INT(20, local.tm_hour);
    TEST_ASSERT_FALSE(reminder.isScheduleDue(makeLocal(2026, 3, 9, 19, 59)));
    TEST_ASSERT_TRUE(reminder.isScheduleDue(makeLocal(2026, 3, 9, 20, 0)));
    TEST_ASSERT_EQUAL_UINT16(2, reminder.getDaysSinceRefill(due));
}

static void test_schedule_snoozes_to_tomorrow_at_configured_time() {
    reminder.configureSchedule(4, 20 * 60);
    const time_t refill = makeLocal(2026, 6, 1, 12, 0);
    reminder.initialize(WaterReminderMode::SCHEDULE, refill);
    const time_t due = makeLocal(2026, 6, 5, 21, 15);
    TEST_ASSERT_TRUE(reminder.isScheduleDue(due));
    TEST_ASSERT_TRUE(reminder.snoozeUntilTomorrow(due));

    tm local{};
    const time_t snoozed = reminder.getNextReminderAt();
    localtime_r(&snoozed, &local);
    TEST_ASSERT_EQUAL_INT(6, local.tm_mday);
    TEST_ASSERT_EQUAL_INT(20, local.tm_hour);
    TEST_ASSERT_FALSE(reminder.isScheduleDue(makeLocal(2026, 6, 6, 19, 59)));
    TEST_ASSERT_TRUE(reminder.isScheduleDue(makeLocal(2026, 6, 6, 20, 0)));
}

static void test_schedule_waits_for_valid_clock() {
    reminder.configureSchedule(4, 20 * 60);
    reminder.initialize(WaterReminderMode::SCHEDULE, 1000);
    TEST_ASSERT_FALSE(WaterRefillReminder::isClockValid(1000));
    TEST_ASSERT_EQUAL_INT64(0, reminder.getNextReminderAt());
    TEST_ASSERT_FALSE(reminder.snoozeUntilTomorrow(1000));
}

static void test_mode_switch_resets_usage_and_calibration() {
    addCalibrationCycle(100.0f);
    completeDrinks(3);
    reminder.addPumpUsage(300.0f);
    reminder.acknowledge();

    reminder.initialize(WaterReminderMode::SCHEDULE, makeLocal(2026, 6, 1, 12, 0));
    TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(WaterReminderMode::SCHEDULE), static_cast<uint8_t>(snapshot().mode));
    TEST_ASSERT_EQUAL_UINT16(0, snapshot().drinks);
    TEST_ASSERT_FALSE(reminder.isCalibrated());
    TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(WaterReminderSeverity::NONE),
                            static_cast<uint8_t>(snapshot().acknowledgedSeverity));
}

static void test_restore_schedule_state() {
    const time_t refill = makeLocal(2026, 6, 1, 12, 0);
    const time_t snooze = makeLocal(2026, 6, 6, 20, 0);
    reminder.configureSchedule(4, 20 * 60);
    WaterReminderSnapshot restored;
    restored.mode = WaterReminderMode::SCHEDULE;
    restored.lastRefillAt = refill;
    restored.snoozedUntil = snooze;
    reminder.restore(restored);
    TEST_ASSERT_EQUAL_INT64(snooze, reminder.getNextReminderAt());
    TEST_ASSERT_TRUE(reminder.isScheduleDue(snooze));
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_count_only_until_calibrated);
    RUN_TEST(test_tracking_requires_completed_setup);
    RUN_TEST(test_hardware_sensor_suspends_tracking);
    RUN_TEST(test_only_completed_real_brews_count_as_drinks);
    RUN_TEST(test_pump_usage_can_warn_early);
    RUN_TEST(test_count_warning_has_precedence_over_low_pump_usage);
    RUN_TEST(test_refill_uses_median_of_latest_five_cycles);
    RUN_TEST(test_invalid_refill_cycle_does_not_calibrate);
    RUN_TEST(test_later_rearms_only_when_severity_increases);
    RUN_TEST(test_refill_resets_usage_and_acknowledgement);
    RUN_TEST(test_restore_rejects_invalid_usage_and_samples);
    RUN_TEST(test_restore_valid_state);
    RUN_TEST(test_reset_calibration_keeps_current_cycle);
    RUN_TEST(test_schedule_uses_local_calendar_days_across_dst);
    RUN_TEST(test_schedule_snoozes_to_tomorrow_at_configured_time);
    RUN_TEST(test_schedule_waits_for_valid_clock);
    RUN_TEST(test_mode_switch_resets_usage_and_calibration);
    RUN_TEST(test_restore_schedule_state);
    return UNITY_END();
}
