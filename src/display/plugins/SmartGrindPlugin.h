#ifndef SMARTGRINDPLUGIN_H
#define SMARTGRINDPLUGIN_H
#include "../core/Plugin.h"
#include <Arduino.h>

const String COMMAND_ON = "Power%20On";
const String COMMAND_OFF = "Power%20off";

struct Event;

class SmartGrindPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

  private:
    void stop();
    void controlRelay(String command);

    Controller *controller = nullptr;
};

#endif // SMARTGRINDPLUGIN_H
