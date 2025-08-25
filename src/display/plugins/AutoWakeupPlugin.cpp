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
            ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup enabled with %d time(s)", 
                     settings->getAutoWakeupTimes().size());
        } else {
            ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup disabled");
        }
    });
}

void AutoWakeupPlugin::loop() {
    if (!settings->isAutoWakeupEnabled() || settings->getAutoWakeupTimes().empty()) {
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
    
    // Don't check the same minute twice
    if (lastCheckedTime == currentTime) {
        return;
    }
    lastCheckedTime = currentTime;
    
    // Check if current time matches any of the target times
    for (const String &targetTime : settings->getAutoWakeupTimes()) {
        if (targetTime == currentTime) {
            ESP_LOGI(LOG_TAG.c_str(), "Auto-wakeup time reached (%s), switching to brew mode", 
                     targetTime.c_str());
            
            controller->setMode(MODE_BREW);
            
            // Trigger plugin events
            pluginManager->trigger("autowakeup:activated", "time", targetTime);
            
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