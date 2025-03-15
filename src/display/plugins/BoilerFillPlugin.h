#ifndef BOILERFILLPLUGIN_H
#define BOILERFILLPLUGIN_H
#include "../core/Plugin.h"

struct Event;

class BoilerFillPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

  private:
    Controller *controller = nullptr;
};

#endif // BOILERFILLPLUGIN_H
