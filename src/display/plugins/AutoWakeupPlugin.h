#ifndef AUTO_WAKEUP_PLUGIN_H
#define AUTO_WAKEUP_PLUGIN_H

#include <display/core/Plugin.h>
#include <display/core/Controller.h>
#include <display/core/PluginManager.h>
#include <display/core/Settings.h>
#include <ctime>

class AutoWakeupPlugin : public Plugin {
public:
    AutoWakeupPlugin();
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

private:
    Controller *controller;
    PluginManager *pluginManager;
    Settings *settings;
    
    unsigned long lastAutoWakeupCheck = 0;
    String lastCheckedTime = "";
    static const unsigned long AUTO_WAKEUP_CHECK_INTERVAL = 30000; // 1 minute
    
    void checkAutoWakeup();
    bool isTimeValid();
    String getCurrentTimeString();
    int getCurrentDayOfWeek();
};

#endif // AUTO_WAKEUP_PLUGIN_H