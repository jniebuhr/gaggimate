#ifndef SMARTGRINDPLUGIN_H
#define SMARTGRINDPLUGIN_H
#include "../core/Plugin.h"
#include <Arduino.h>

constexpr int SG_MODE_OFF = 0;
constexpr int SG_MODE_OFF_ON = 1;
constexpr int SG_MODE_ON_OFF = 2;

constexpr int SG_TYPE_TASMOTA = 0;
constexpr int SG_TYPE_ESPHOME = 1;
constexpr int SG_TYPE_CUSTOM = 2;

constexpr int SG_METHOD_GET = 0;
constexpr int SG_METHOD_POST = 1;

struct Event;

class SmartGrindPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {
        // event-driven, nothing to poll
    }

  private:
    void start();
    void stop();
    void controlRelay(bool on);

    Controller *controller = nullptr;
};

#endif // SMARTGRINDPLUGIN_H
