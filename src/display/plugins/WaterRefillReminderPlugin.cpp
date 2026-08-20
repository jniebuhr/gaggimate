#include "WaterRefillReminderPlugin.h"

#include <LittleFS.h>
#include <SD_MMC.h>
#include <display/core/Controller.h>
#include <display/core/process/BrewProcess.h>

namespace {
constexpr float MAX_INTEGRATION_INTERVAL_SECONDS = 2.0f;
}

WaterRefillReminderPlugin WaterRefillReminderTracker; // NOSONAR - Plugins have application lifetime.

void WaterRefillReminderPlugin::setup(Controller *c, PluginManager *pm) {
    controller = c;
    usingSd = controller->isSDCard();
    fs = usingSd ? static_cast<FS *>(&SD_MMC) : static_cast<FS *>(&LittleFS);
    applySettings();
    setupRequired = !loadState();
    if (setupRequired && !usingSd && controller->getSettings().isWaterReminderStorageWarningAccepted()) {
        controller->getSettings().setWaterReminderStorageWarningAccepted(false);
        controller->getSettings().save(true);
    }

    pm->on("settings:changed", [this](Event const &) {
        std::lock_guard<std::mutex> guard(mutex);
        applySettings();
    });
    pm->on("controller:brew:end", [this](Event const &) { handleBrewEnd(); });
    pm->on("controller:process:end", [this](Event const &) {
        std::lock_guard<std::mutex> guard(mutex);
        if (isActive() && configuredMode == WaterReminderMode::USAGE) {
            saveState();
        }
    });
    lastLoopAt = millis();
}

void WaterRefillReminderPlugin::loop() {
    std::lock_guard<std::mutex> guard(mutex);
    const unsigned long now = millis();
    integratePumpUsage(now);
    lastLoopAt = now;
}

void WaterRefillReminderPlugin::applySettings() {
    const Settings &settings = controller->getSettings();
    enabled = settings.isWaterReminderEnabled();
    configuredMode = static_cast<WaterReminderMode>(settings.getWaterReminderMode());
    reminder.configure(settings.getWaterReminderWarningCount(), settings.getWaterReminderCriticalCount());
    reminder.configureSchedule(settings.getWaterReminderScheduleDays(),
                               parseScheduleMinute(settings.getWaterReminderScheduleTime()));
    if (!setupRequired && reminder.getSnapshot().mode != configuredMode) {
        setupRequired = true;
    }
}

uint16_t WaterRefillReminderPlugin::parseScheduleMinute(const String &value) {
    return static_cast<uint16_t>(value.substring(0, 2).toInt() * 60 + value.substring(3, 5).toInt());
}

void WaterRefillReminderPlugin::integratePumpUsage(unsigned long now) {
    if (!isActive() || configuredMode != WaterReminderMode::USAGE || lastLoopAt == 0) {
        return;
    }

    bool pumpProcessActive = false;
    {
        std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
        Process *process = controller->getProcess();
        if (process != nullptr) {
            const int type = process->getType();
            pumpProcessActive = type == MODE_BREW || type == MODE_STEAM || type == MODE_WATER;
        }
    }
    if (!pumpProcessActive) {
        return;
    }

    const float elapsed = static_cast<float>(now - lastLoopAt) / 1000.0f;
    if (elapsed <= 0.0f || elapsed > MAX_INTEGRATION_INTERVAL_SECONDS) {
        return;
    }
    reminder.addPumpUsage(controller->getCurrentPumpFlow() * elapsed);
}

void WaterRefillReminderPlugin::handleBrewEnd() {
    std::lock_guard<std::mutex> guard(mutex);
    if (!isActive() || configuredMode != WaterReminderMode::USAGE) {
        return;
    }

    {
        std::lock_guard<std::recursive_mutex> processGuard(controller->getProcessLock());
        Process *last = controller->getLastProcess();
        if (last != nullptr && last->getType() == MODE_BREW) {
            auto *brew = static_cast<BrewProcess *>(last);
            WaterReminderBrewOutcome outcome = WaterReminderBrewOutcome::ABORTED;
            if (brew->processPhase == ProcessPhase::FINISHED && brew->lastExitReason != PhaseExitReason::SAFETY) {
                outcome = brew->isUtility() ? WaterReminderBrewOutcome::UTILITY : WaterReminderBrewOutcome::DRINK;
            }
            reminder.recordBrew(outcome);
        }
    }
    saveState();
}

bool WaterRefillReminderPlugin::isActive() const {
    return WaterRefillReminder::canTrack(enabled, controller->getSystemInfo().capabilities.tof, setupRequired);
}

bool WaterRefillReminderPlugin::loadState() {
    if (fs == nullptr) {
        return false;
    }

    if (fs->exists(STATE_PATH) && loadStateFile(STATE_PATH)) {
        return true;
    }
    if (fs->exists(BACKUP_PATH) && loadStateFile(BACKUP_PATH)) {
        fs->remove(STATE_PATH);
        fs->rename(BACKUP_PATH, STATE_PATH);
        return true;
    }

    ESP_LOGW("WaterRefillReminder", "Unable to read reminder state");
    return false;
}

bool WaterRefillReminderPlugin::loadStateFile(const char *path) {
    File file = fs->open(path, FILE_READ);
    JsonDocument document;
    const DeserializationError error = deserializeJson(document, file);
    file.close();
    if (error || document["version"].as<uint8_t>() != STATE_VERSION) {
        return false;
    }

    WaterReminderSnapshot snapshot;
    snapshot.mode = static_cast<WaterReminderMode>(document["mode"] | 0);
    if (snapshot.mode != configuredMode || snapshot.mode > WaterReminderMode::SCHEDULE) {
        return false;
    }
    snapshot.drinks = document["drinks"] | 0;
    snapshot.pumpUnits = document["pumpUnits"] | 0.0f;
    snapshot.acknowledgedSeverity = static_cast<WaterReminderSeverity>(document["acknowledgedSeverity"] | 0);
    for (JsonVariantConst value : document["calibration"].as<JsonArrayConst>()) {
        if (snapshot.calibrationCount == WaterReminderSnapshot::MAX_CALIBRATION_SAMPLES) {
            break;
        }
        snapshot.calibration[snapshot.calibrationCount++] = value.as<float>();
    }
    snapshot.lastRefillAt = static_cast<time_t>(document["lastRefillAt"].as<int64_t>());
    snapshot.snoozedUntil = static_cast<time_t>(document["snoozedUntil"].as<int64_t>());
    reminder.restore(snapshot);
    return snapshot.mode != WaterReminderMode::SCHEDULE || WaterRefillReminder::isClockValid(reminder.getSnapshot().lastRefillAt);
}

bool WaterRefillReminderPlugin::saveState() {
    if (fs == nullptr || setupRequired) {
        return false;
    }

    JsonDocument document;
    const WaterReminderSnapshot &snapshot = reminder.getSnapshot();
    document["version"] = STATE_VERSION;
    document["mode"] = static_cast<uint8_t>(snapshot.mode);
    document["drinks"] = snapshot.drinks;
    document["pumpUnits"] = snapshot.pumpUnits;
    document["acknowledgedSeverity"] = static_cast<uint8_t>(snapshot.acknowledgedSeverity);
    JsonArray calibration = document["calibration"].to<JsonArray>();
    for (size_t i = 0; i < snapshot.calibrationCount; i++) {
        calibration.add(snapshot.calibration[i]);
    }
    document["lastRefillAt"] = static_cast<int64_t>(snapshot.lastRefillAt);
    document["snoozedUntil"] = static_cast<int64_t>(snapshot.snoozedUntil);

    fs->remove(TEMP_PATH);
    File file = fs->open(TEMP_PATH, FILE_WRITE);
    if (!file || serializeJson(document, file) == 0) {
        file.close();
        ESP_LOGW("WaterRefillReminder", "Unable to write reminder state");
        return false;
    }
    file.flush();
    file.close();

    fs->remove(BACKUP_PATH);
    if (fs->exists(STATE_PATH) && !fs->rename(STATE_PATH, BACKUP_PATH)) {
        ESP_LOGW("WaterRefillReminder", "Unable to rotate reminder state");
        return false;
    }
    if (!fs->rename(TEMP_PATH, STATE_PATH)) {
        fs->rename(BACKUP_PATH, STATE_PATH);
        ESP_LOGW("WaterRefillReminder", "Unable to commit reminder state");
        return false;
    }
    fs->remove(BACKUP_PATH);
    return true;
}

WaterReminderState WaterRefillReminderPlugin::getState() {
    std::lock_guard<std::mutex> guard(mutex);
    WaterReminderState state;
    state.enabled = isActive();
    state.suspendedByWaterSensor = controller->getSystemInfo().capabilities.tof;
    state.setupRequired = setupRequired;
    state.mode = configuredMode;
    const time_t now = time(nullptr);
    state.clockReady = WaterRefillReminder::isClockValid(now);
    if (configuredMode == WaterReminderMode::USAGE) {
        state.severity = reminder.getSeverity();
        state.drinks = reminder.getSnapshot().drinks;
        state.calibrated = reminder.isCalibrated();
        state.warningPending = reminder.isWarningPending();
        state.pumpLed = reminder.isPumpLed();
    } else {
        state.scheduleDue = reminder.isScheduleDue(now);
        state.warningPending = state.scheduleDue;
        state.daysSinceRefill = reminder.getDaysSinceRefill(now);
        state.nextReminderAt = reminder.getNextReminderAt();
    }
    return state;
}

bool WaterRefillReminderPlugin::initialize() {
    std::lock_guard<std::mutex> guard(mutex);
    if (!enabled || controller->getSystemInfo().capabilities.tof ||
        (!usingSd && !controller->getSettings().isWaterReminderStorageWarningAccepted())) {
        return false;
    }
    if (!setupRequired && reminder.getSnapshot().mode == configuredMode) {
        return true;
    }

    const time_t now = time(nullptr);
    if (configuredMode == WaterReminderMode::SCHEDULE && !WaterRefillReminder::isClockValid(now)) {
        return false;
    }

    reminder.initialize(configuredMode, now);
    applySettings();
    setupRequired = false;
    if (!saveState()) {
        setupRequired = true;
        return false;
    }
    return true;
}

void WaterRefillReminderPlugin::acknowledge() {
    std::lock_guard<std::mutex> guard(mutex);
    if (!isActive() || configuredMode != WaterReminderMode::USAGE) {
        return;
    }
    reminder.acknowledge();
    saveState();
}

void WaterRefillReminderPlugin::refill() {
    std::lock_guard<std::mutex> guard(mutex);
    if (!isActive()) {
        return;
    }
    const time_t now = time(nullptr);
    if (configuredMode == WaterReminderMode::SCHEDULE && !WaterRefillReminder::isClockValid(now)) {
        return;
    }
    reminder.refill(now);
    saveState();
}

void WaterRefillReminderPlugin::resetCalibration() {
    std::lock_guard<std::mutex> guard(mutex);
    if (!isActive() || configuredMode != WaterReminderMode::USAGE) {
        return;
    }
    reminder.resetCalibration();
    saveState();
}

void WaterRefillReminderPlugin::snoozeUntilTomorrow() {
    std::lock_guard<std::mutex> guard(mutex);
    if (!isActive() || configuredMode != WaterReminderMode::SCHEDULE) {
        return;
    }
    if (reminder.snoozeUntilTomorrow(time(nullptr))) {
        saveState();
    }
}
