#include "AutoWakeupPlugin.h"
#include <display/core/constants.h>
#include <esp_log.h>

const String LOG_TAG = F("AutoWakeupPlugin");

AutoWakeupPlugin::AutoWakeupPlugin() {}

void AutoWakeupPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    this->pluginManager = pluginManager;
    this->settings = &controller->getSettings();
    
    ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup plugin initialized");
    
    // Listen for settings changes to log configuration
    pluginManager->on("settings:changed", [this](const Event &event) {
        if (settings->isAutoWakeupEnabled()) {
            ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup enabled with %d schedule(s)", 
                     settings->getAutoWakeupSchedules().size());
        } else {
            ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup disabled");
        }
    });
}

void AutoWakeupPlugin::loop() {
    if (!settings->isAutoWakeupEnabled() || settings->getAutoWakeupSchedules().empty()) {
        return;
    }
    
    unsigned long now = millis();
    
    // Check every minute
    if (now - lastAutoWakeupCheck > AUTO_WAKEUP_CHECK_INTERVAL) {
        lastAutoWakeupCheck = now;
        
        if (isTimeValid()) {
            checkAutoWakeup();
        }
    }
}

void AutoWakeupPlugin::checkAutoWakeup() {
    // Only attempt if in standby mode
    if (controller->getMode() != MODE_STANDBY) {
        return;
    }
    
    String currentTime = getCurrentTimeString();
    int currentDayOfWeek = getCurrentDayOfWeek(); // 1=Monday, 7=Sunday
    
    // Don't check the same minute twice
    if (lastCheckedTime == currentTime) {
        return;
    }
    lastCheckedTime = currentTime;
    
    // Check if current time and day matches any of the schedules
    for (const AutoWakeupSchedule &schedule : settings->getAutoWakeupSchedules()) {
        if (schedule.time == currentTime && schedule.isDayEnabled(currentDayOfWeek)) {
            ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup schedule matched (time: %s, day: %d), switching to brew mode", 
                     schedule.time.c_str(), currentDayOfWeek);
            
            controller->setMode(MODE_BREW);
            
            // Trigger plugin events
            pluginManager->trigger("autowakeup:activated", "time", schedule.time);
            
            return; // Only trigger once per minute
        }
    }
}

bool AutoWakeupPlugin::isTimeValid() {
    // Check if we have a valid time (year > 2020 means NTP has synced)
    time_t now;
    struct tm timeinfo;
    time(&now);
    localtime_r(&now, &timeinfo);
    
    return timeinfo.tm_year > (2020 - 1900);
}

String AutoWakeupPlugin::getCurrentTimeString() {
    time_t now;
    struct tm timeinfo;
    time(&now);
    localtime_r(&now, &timeinfo);
    
    // Format current time as HH:MM
    char currentTime[6];
    strftime(currentTime, sizeof(currentTime), "%H:%M", &timeinfo);
    
    return String(currentTime);
}

int AutoWakeupPlugin::getCurrentDayOfWeek() {
    time_t now;
    struct tm timeinfo;
    time(&now);
    localtime_r(&now, &timeinfo);
    
    // Convert tm_wday (0=Sunday, 1=Monday, ..., 6=Saturday) to our format (1=Monday, ..., 7=Sunday)
    int dayOfWeek = timeinfo.tm_wday;
    if (dayOfWeek == 0) {
        return 7; // Sunday
    } else {
        return dayOfWeek; // Monday=1, Tuesday=2, ..., Saturday=6
    }
}