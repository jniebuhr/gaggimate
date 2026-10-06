#ifndef CLEANINGSCHEDULEPLUGIN_H
#define CLEANINGSCHEDULEPLUGIN_H

#include <display/core/Plugin.h>

class Controller;
class PluginManager;
class Settings;
class WebSocketHandler;

// Tracks backflush/descaling due dates by time and shot count; WarningManager surfaces them as warnings.
class CleaningSchedulePlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    static bool isBackflushDue(const Settings &settings);
    static bool isDescalingDue(const Settings &settings);

  private:
    void registerWsHandlers(WebSocketHandler *ws);
    bool startCleaning(const char *profileId);
    void completeBackflush();
    void completeDescaling();
    void onBrewEnd();

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    unsigned long lastCheck = 0;
};

#endif // CLEANINGSCHEDULEPLUGIN_H
