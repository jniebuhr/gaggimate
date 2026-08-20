#include "WaterRefillReminder.h"

#include <math.h>

bool WaterRefillReminder::canTrack(bool enabled, bool waterSensorAvailable, bool setupRequired) {
    return enabled && !waterSensorAvailable && !setupRequired;
}

bool WaterRefillReminder::isClockValid(time_t now) {
    tm local{};
    return now > 0 && localtime_r(&now, &local) != nullptr && local.tm_year > (2020 - 1900);
}

void WaterRefillReminder::configure(uint16_t warning, uint16_t critical) {
    if (warning < 1 || critical <= warning) {
        return;
    }
    warningCount = warning;
    criticalCount = critical;
}

void WaterRefillReminder::configureSchedule(uint8_t days, uint16_t minuteOfDay) {
    if (days >= 1 && days <= 30 && minuteOfDay < 24 * 60) {
        scheduleDays = days;
        scheduleMinuteOfDay = minuteOfDay;
    }
}

void WaterRefillReminder::addPumpUsage(float usage) {
    if (isfinite(usage) && usage > 0.0f) {
        state.pumpUnits += usage;
    }
}

void WaterRefillReminder::recordBrew(WaterReminderBrewOutcome outcome) {
    if (outcome == WaterReminderBrewOutcome::DRINK && state.drinks < UINT16_MAX) {
        state.drinks++;
    }
}

void WaterRefillReminder::initialize(WaterReminderMode reminderMode, time_t now) {
    state = {};
    state.mode = reminderMode;
    state.lastRefillAt = reminderMode == WaterReminderMode::SCHEDULE && isClockValid(now) ? now : 0;
}

bool WaterRefillReminder::refill(time_t now) {
    bool addedSample = false;
    if (state.mode == WaterReminderMode::USAGE && state.drinks > 0 && isfinite(state.pumpUnits) && state.pumpUnits > 0.0f) {
        const float sample = state.pumpUnits / static_cast<float>(state.drinks);
        if (state.calibrationCount < MAX_CALIBRATION_SAMPLES) {
            state.calibration[state.calibrationCount++] = sample;
        } else {
            for (size_t i = 1; i < MAX_CALIBRATION_SAMPLES; i++) {
                state.calibration[i - 1] = state.calibration[i];
            }
            state.calibration[MAX_CALIBRATION_SAMPLES - 1] = sample;
        }
        addedSample = true;
    }

    state.drinks = 0;
    state.pumpUnits = 0.0f;
    state.acknowledgedSeverity = WaterReminderSeverity::NONE;
    if (state.mode == WaterReminderMode::SCHEDULE && isClockValid(now)) {
        state.lastRefillAt = now;
    }
    state.snoozedUntil = 0;
    return addedSample;
}

void WaterRefillReminder::resetCalibration() {
    for (float &sample : state.calibration) {
        sample = 0.0f;
    }
    state.calibrationCount = 0;
}

void WaterRefillReminder::acknowledge() { state.acknowledgedSeverity = getSeverity(); }

bool WaterRefillReminder::snoozeUntilTomorrow(time_t now) {
    if (state.mode != WaterReminderMode::SCHEDULE || !isClockValid(now)) {
        return false;
    }
    state.snoozedUntil = scheduleFrom(now, 1);
    return state.snoozedUntil > now;
}

float WaterRefillReminder::getPumpUnitsPerDrink() const {
    if (state.calibrationCount == 0) {
        return 0.0f;
    }

    float ordered[MAX_CALIBRATION_SAMPLES]{};
    for (size_t i = 0; i < state.calibrationCount; i++) {
        ordered[i] = state.calibration[i];
    }
    for (size_t i = 1; i < state.calibrationCount; i++) {
        const float value = ordered[i];
        size_t position = i;
        while (position > 0 && ordered[position - 1] > value) {
            ordered[position] = ordered[position - 1];
            position--;
        }
        ordered[position] = value;
    }
    const size_t middle = state.calibrationCount / 2;
    if (state.calibrationCount % 2 == 0) {
        return (ordered[middle - 1] + ordered[middle]) / 2.0f;
    }
    return ordered[middle];
}

float WaterRefillReminder::getPumpEquivalentDrinks() const {
    const float baseline = getPumpUnitsPerDrink();
    return baseline > 0.0f ? state.pumpUnits / baseline : 0.0f;
}

WaterReminderSeverity WaterRefillReminder::severityFor(float value, uint16_t warning, uint16_t critical) {
    if (value >= static_cast<float>(critical)) {
        return WaterReminderSeverity::CRITICAL;
    }
    if (value >= static_cast<float>(warning)) {
        return WaterReminderSeverity::WARNING;
    }
    return WaterReminderSeverity::NONE;
}

WaterReminderSeverity WaterRefillReminder::getSeverity() const {
    if (state.mode != WaterReminderMode::USAGE) {
        return WaterReminderSeverity::NONE;
    }
    const WaterReminderSeverity countSeverity = severityFor(state.drinks, warningCount, criticalCount);
    if (!isCalibrated()) {
        return countSeverity;
    }
    const WaterReminderSeverity pumpSeverity = severityFor(getPumpEquivalentDrinks(), warningCount, criticalCount);
    return countSeverity > pumpSeverity ? countSeverity : pumpSeverity;
}

bool WaterRefillReminder::isWarningPending() const { return getSeverity() > state.acknowledgedSeverity; }

bool WaterRefillReminder::isPumpLed() const {
    if (state.mode != WaterReminderMode::USAGE || !isCalibrated()) {
        return false;
    }
    return severityFor(getPumpEquivalentDrinks(), warningCount, criticalCount) >
           severityFor(state.drinks, warningCount, criticalCount);
}

int64_t WaterRefillReminder::localDayNumber(const tm &date) {
    // Compare local dates instead of elapsed hours so DST changes still count as one day.
    int year = date.tm_year + 1900;
    unsigned month = static_cast<unsigned>(date.tm_mon + 1);
    const unsigned day = static_cast<unsigned>(date.tm_mday);
    year -= month <= 2;
    const int era = (year >= 0 ? year : year - 399) / 400;
    const unsigned yearOfEra = static_cast<unsigned>(year - era * 400);
    const unsigned adjustedMonth = month > 2 ? month - 3 : month + 9;
    const unsigned dayOfYear = (153 * adjustedMonth + 2) / 5 + day - 1;
    const unsigned dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
    return era * 146097LL + static_cast<int64_t>(dayOfEra);
}

time_t WaterRefillReminder::scheduleFrom(time_t anchor, uint8_t days) const {
    tm local{};
    if (!isClockValid(anchor) || localtime_r(&anchor, &local) == nullptr) {
        return 0;
    }
    local.tm_mday += days;
    local.tm_hour = scheduleMinuteOfDay / 60;
    local.tm_min = scheduleMinuteOfDay % 60;
    local.tm_sec = 0;
    local.tm_isdst = -1;
    return mktime(&local);
}

time_t WaterRefillReminder::getNextReminderAt() const {
    if (state.mode != WaterReminderMode::SCHEDULE || !isClockValid(state.lastRefillAt)) {
        return 0;
    }
    return state.snoozedUntil > 0 ? state.snoozedUntil : scheduleFrom(state.lastRefillAt, scheduleDays);
}

uint16_t WaterRefillReminder::getDaysSinceRefill(time_t now) const {
    tm refill{};
    tm current{};
    if (!isClockValid(state.lastRefillAt) || !isClockValid(now) || localtime_r(&state.lastRefillAt, &refill) == nullptr ||
        localtime_r(&now, &current) == nullptr) {
        return 0;
    }
    const int64_t elapsed = localDayNumber(current) - localDayNumber(refill);
    return elapsed > 0 ? static_cast<uint16_t>(elapsed > UINT16_MAX ? UINT16_MAX : elapsed) : 0;
}

bool WaterRefillReminder::isScheduleDue(time_t now) const {
    const time_t next = getNextReminderAt();
    return isClockValid(now) && next > 0 && now >= next;
}

void WaterRefillReminder::restore(const WaterReminderSnapshot &snapshot) {
    state = snapshot;
    state.pumpUnits = isfinite(snapshot.pumpUnits) && snapshot.pumpUnits > 0.0f ? snapshot.pumpUnits : 0.0f;
    state.calibrationCount =
        snapshot.calibrationCount < MAX_CALIBRATION_SAMPLES ? snapshot.calibrationCount : MAX_CALIBRATION_SAMPLES;
    for (size_t i = 0; i < state.calibrationCount; i++) {
        if (!isfinite(state.calibration[i]) || state.calibration[i] <= 0.0f) {
            state.calibrationCount = i;
            break;
        }
    }
    for (size_t i = state.calibrationCount; i < MAX_CALIBRATION_SAMPLES; i++) {
        state.calibration[i] = 0.0f;
    }
    if (state.acknowledgedSeverity > WaterReminderSeverity::CRITICAL) {
        state.acknowledgedSeverity = WaterReminderSeverity::NONE;
    }
    state.lastRefillAt = isClockValid(state.lastRefillAt) ? state.lastRefillAt : 0;
    state.snoozedUntil = isClockValid(state.snoozedUntil) ? state.snoozedUntil : 0;
}
