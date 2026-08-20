#ifndef WATERREFILLREMINDERPLUGIN_H
#define WATERREFILLREMINDERPLUGIN_H

#include <ArduinoJson.h>
#include <FS.h>
#include <display/core/Plugin.h>
#include <display/models/WaterRefillReminder.h>
#include <mutex>
#include <time.h>

struct WaterReminderState {
    bool enabled = false;
    bool suspendedByWaterSensor = false;
    bool setupRequired = true;
    WaterReminderMode mode = WaterReminderMode::USAGE;
    WaterReminderSeverity severity = WaterReminderSeverity::NONE;
    uint16_t drinks = 0;
    bool calibrated = false;
    bool warningPending = false;
    bool pumpLed = false;
    bool scheduleDue = false;
    bool clockReady = false;
    uint16_t daysSinceRefill = 0;
    time_t nextReminderAt = 0;
};

class WaterRefillReminderPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    WaterReminderState getState();
    bool initialize();
    void acknowledge();
    void refill();
    void resetCalibration();
    void snoozeUntilTomorrow();

  private:
    static constexpr uint8_t STATE_VERSION = 2;
    static constexpr const char *STATE_PATH = "/water-refill-reminder.json";
    static constexpr const char *TEMP_PATH = "/water-refill-reminder.tmp";
    static constexpr const char *BACKUP_PATH = "/water-refill-reminder.bak";

    void applySettings();
    void integratePumpUsage(unsigned long now);
    void handleBrewEnd();
    bool loadState();
    bool loadStateFile(const char *path);
    bool saveState();
    bool isActive() const;
    static uint16_t parseScheduleMinute(const String &value);

    Controller *controller = nullptr;
    FS *fs = nullptr;
    WaterRefillReminder reminder;
    std::mutex mutex;
    unsigned long lastLoopAt = 0;
    bool enabled = false;
    bool setupRequired = true;
    bool usingSd = false;
    WaterReminderMode configuredMode = WaterReminderMode::USAGE;
};

extern WaterRefillReminderPlugin WaterRefillReminderTracker;

#endif // WATERREFILLREMINDERPLUGIN_H
