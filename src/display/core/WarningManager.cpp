#include "WarningManager.h"
#include <display/core/Controller.h>
#include <display/plugins/BLEScalePlugin.h>

namespace {
struct WarningInfo {
    const char *key;
    const char *label;
};
// Order must match WarningType; keys are shared with the web UI.
const WarningInfo WARNING_INFO[WARNING_TYPE_COUNT] = {
    {"water", "Water tank low"},           {"flush", "Flush recommended"},
    {"switch", "Steam switch is on"},      {"scaleConnected", "Scale not connected"},
    {"scaleBattery", "Scale battery low"}, {"temperature", "Temperature not stable"},
};
} // namespace

void WarningManager::setup(Controller *controller) { this->controller = controller; }

void WarningManager::loop() {
    const unsigned long now = millis();
    if (now - lastTempSample > WARNING_TEMP_SAMPLE_INTERVAL_MS) {
        lastTempSample = now;
        sampleTemperature();
    }
    evaluate();
}

// Stable = every sample of the last 20 s within max(2 °C, 2 %) of the setpoint; reset on a setpoint change.
void WarningManager::sampleTemperature() {
    const int currentTemp = static_cast<int>(controller->getCurrentTemp());
    const int targetTemp = static_cast<int>(controller->getTargetTemp());
    if (currentTemp > 0) {
        if (tempHistoryIndex >= WARNING_TEMP_HISTORY_LENGTH) {
            tempHistoryIndex = 0;
            tempHistoryInitialized = true;
        }
        tempHistory[tempHistoryIndex++] = currentTemp;
    }
    if (tempHistoryInitialized) {
        float totalError = 0.0f;
        float maxError = 0.0f;
        for (int i = 0; i < WARNING_TEMP_HISTORY_LENGTH; i++) {
            const float error = abs(tempHistory[i] - targetTemp);
            totalError += error;
            maxError = error > maxError ? error : maxError;
        }
        const float avgError = totalError / WARNING_TEMP_HISTORY_LENGTH;
        const float errorMargin = max(2.0f, static_cast<float>(targetTemp) * 0.02f);
        temperatureStable = avgError < errorMargin && maxError <= errorMargin;
    }
    if (prevTargetTemp != targetTemp) {
        temperatureStable = false;
    }
    prevTargetTemp = targetTemp;
}

void WarningManager::evaluate() {
    const Settings &settings = controller->getSettings();
    const bool scaleConnected = BLEScales.isConnected();

    active[WARNING_WATER] = controller->getSystemInfo().capabilities.tof && controller->isLowWaterLevel();
    active[WARNING_FLUSH] = controller->isFlushPending();
    active[WARNING_SWITCH] = controller->isSteamSwitchOn();
    active[WARNING_SCALE_CONNECTED] = !scaleConnected && settings.getSavedScale() != "";
    active[WARNING_SCALE_BATTERY] = scaleConnected && BLEScales.hasBatteryLevel() && BLEScales.getBatteryLevel() < 20;
    active[WARNING_TEMPERATURE] = !temperatureStable;

    level[WARNING_WATER] = settings.getWarnWaterLevel();
    level[WARNING_FLUSH] = settings.getWarnFlush();
    level[WARNING_SWITCH] = settings.getWarnSteamSwitch();
    level[WARNING_SCALE_CONNECTED] = settings.getWarnScaleConnected();
    level[WARNING_SCALE_BATTERY] = settings.getWarnScaleBattery();
    level[WARNING_TEMPERATURE] = settings.getWarnTemperature();
}

bool WarningManager::isWarn(WarningType type) const { return active[type] && level[type] == WARNING_LEVEL_WARN; }

bool WarningManager::isError(WarningType type) const { return active[type] && level[type] == WARNING_LEVEL_ERROR; }

bool WarningManager::hasWarning() const {
    for (int i = 0; i < WARNING_TYPE_COUNT; i++)
        if (isWarn(static_cast<WarningType>(i)))
            return true;
    return false;
}

bool WarningManager::hasError() const {
    for (int i = 0; i < WARNING_TYPE_COUNT; i++)
        if (isError(static_cast<WarningType>(i)))
            return true;
    return false;
}

// Newline-separated labels of every active warning that is not ignored, for the confirm screens.
String WarningManager::getLabels() const {
    String labels;
    for (int i = 0; i < WARNING_TYPE_COUNT; i++) {
        const auto type = static_cast<WarningType>(i);
        if (!isWarn(type) && !isError(type))
            continue;
        if (labels.length() > 0)
            labels += "\n";
        labels += WARNING_INFO[i].label;
    }
    return labels;
}

const char *WarningManager::key(WarningType type) { return WARNING_INFO[type].key; }

const char *WarningManager::label(WarningType type) { return WARNING_INFO[type].label; }
