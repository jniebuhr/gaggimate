#ifndef LEDCONTROLPLUGIN_H
#define LEDCONTROLPLUGIN_H
#include "LightBehaviour.h"
#include <Arduino.h>
#include <GaggiMateComm.h>
#include <array>
#include <atomic>
#include <display/core/Plugin.h>

class LedControlPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop();

  private:
    void updateControl();
    unsigned long lastUpdate = 0;
    std::atomic<bool> forceSend{true};
    std::array<LedChannelCommand, 10> lastChannels{};
    size_t lastCount = 0;
    LightBehaviour systemLight;
    LightBehaviour baristaLight;
    Controller *controller = nullptr;
};
#endif // LEDCONTROLPLUGIN_H
