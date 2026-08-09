#ifndef WATERREFILLREMINDER_H
#define WATERREFILLREMINDER_H

#include <stddef.h>
#include <stdint.h>
#include <time.h>

enum class WaterReminderMode : uint8_t {
    USAGE = 0,
    SCHEDULE = 1,
};

enum class WaterReminderSeverity : uint8_t {
    NONE = 0,
    WARNING = 1,
    CRITICAL = 2,
};

enum class WaterReminderBrewOutcome : uint8_t {
    ABORTED,
    UTILITY,
    DRINK,
};

struct WaterReminderSnapshot {
    static constexpr size_t MAX_CALIBRATION_SAMPLES = 5;

    WaterReminderMode mode = WaterReminderMode::USAGE;
    uint16_t drinks = 0;
    float pumpUnits = 0.0f;
    float calibration[MAX_CALIBRATION_SAMPLES]{};
    size_t calibrationCount = 0;
    WaterReminderSeverity acknowledgedSeverity = WaterReminderSeverity::NONE;
    time_t lastRefillAt = 0;
    time_t snoozedUntil = 0;
};

class WaterRefillReminder {
  public:
    static constexpr size_t MAX_CALIBRATION_SAMPLES = WaterReminderSnapshot::MAX_CALIBRATION_SAMPLES;

    static bool canTrack(bool enabled, bool waterSensorAvailable, bool setupRequired);
    static bool isClockValid(time_t now);

    void configure(uint16_t warningCount, uint16_t criticalCount);
    void configureSchedule(uint8_t days, uint16_t minuteOfDay);
    void addPumpUsage(float pumpUnits);
    void recordBrew(WaterReminderBrewOutcome outcome);
    void initialize(WaterReminderMode reminderMode, time_t now);
    bool refill(time_t now = 0);
    void resetCalibration();
    void acknowledge();
    bool snoozeUntilTomorrow(time_t now);

    const WaterReminderSnapshot &getSnapshot() const { return state; }
    float getPumpUnitsPerDrink() const;
    float getPumpEquivalentDrinks() const;
    WaterReminderSeverity getSeverity() const;
    bool isWarningPending() const;
    bool isPumpLed() const;
    bool isCalibrated() const { return state.calibrationCount > 0; }
    time_t getNextReminderAt() const;
    uint16_t getDaysSinceRefill(time_t now) const;
    bool isScheduleDue(time_t now) const;

    void restore(const WaterReminderSnapshot &snapshot);

  private:
    static WaterReminderSeverity severityFor(float value, uint16_t warning, uint16_t critical);
    static int64_t localDayNumber(const tm &date);
    time_t scheduleFrom(time_t anchor, uint8_t days) const;

    uint16_t warningCount = 4;
    uint16_t criticalCount = 5;
    uint8_t scheduleDays = 4;
    uint16_t scheduleMinuteOfDay = 20 * 60;
    WaterReminderSnapshot state;
};

#endif // WATERREFILLREMINDER_H
