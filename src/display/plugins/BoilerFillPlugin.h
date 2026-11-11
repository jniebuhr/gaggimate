#ifndef BOILERFILLPLUGIN_H
#define BOILERFILLPLUGIN_H

#include <display/core/Plugin.h>

struct Event;

class BoilerFillPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {
        // event-driven, nothing to poll
    }

  private:
    Controller *controller = nullptr;
};

#endif // BOILERFILLPLUGIN_H
