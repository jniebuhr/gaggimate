#ifndef WARNING_MANAGER_H
#define WARNING_MANAGER_H

#include <Arduino.h>

class Controller;

enum WarningType {
    WARNING_WATER = 0,
    WARNING_FLUSH,
    WARNING_SWITCH,
    WARNING_SCALE_CONNECTED,
    WARNING_SCALE_BATTERY,
    WARNING_TEMPERATURE,
    WARNING_TYPE_COUNT
};

constexpr int WARNING_TEMP_SAMPLE_INTERVAL_MS = 250;
constexpr int WARNING_TEMP_HISTORY_LENGTH = 20 * 1000 / WARNING_TEMP_SAMPLE_INTERVAL_MS;

// Single source of truth for machine warnings: raw conditions, configured severity, labels.
class WarningManager {
  public:
    void setup(Controller *controller);
    void loop();

    bool isActive(WarningType type) const { return active[type]; }
    int getLevel(WarningType type) const { return level[type]; }
    bool isWarn(WarningType type) const;
    bool isError(WarningType type) const;
    bool hasWarning() const;
    bool hasError() const;
    String getLabels() const;
    bool isTemperatureStable() const { return temperatureStable; }

    static const char *key(WarningType type);
    static const char *label(WarningType type);

  private:
    void sampleTemperature();
    void evaluate();

    Controller *controller = nullptr;
    bool active[WARNING_TYPE_COUNT] = {false};
    int level[WARNING_TYPE_COUNT] = {0};

    int tempHistory[WARNING_TEMP_HISTORY_LENGTH] = {0};
    int tempHistoryIndex = 0;
    int prevTargetTemp = 0;
    bool tempHistoryInitialized = false;
    bool temperatureStable = false;
    unsigned long lastTempSample = 0;
};

#endif // WARNING_MANAGER_H
