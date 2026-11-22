#ifndef AUTO_WAKEUP_PLUGIN_H
#define AUTO_WAKEUP_PLUGIN_H

#include <ctime>
#include <display/core/Controller.h>
#include <display/core/Plugin.h>
#include <display/core/PluginManager.h>
#include <display/core/Settings.h>

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
    bool switchOffPending = false;
    static const unsigned long SWITCH_OFF_IDLE_MS = 120000;        // an off time waits for two minutes without activity
    static const unsigned long AUTO_WAKEUP_CHECK_INTERVAL = 30000; // 1 minute

    void checkAutoWakeup();
    void checkSwitchOff();
    bool isTimeValid();
    String getCurrentTimeString();
    int getCurrentDayOfWeek();
};

#endif // AUTO_WAKEUP_PLUGIN_H