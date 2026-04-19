#ifndef MATTERPLUGIN_H
#define MATTERPLUGIN_H

#ifdef GAGGIMATE_MATTER

#include "../core/Plugin.h"

struct Event;

class MatterPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

  private:
    void start(Event const &event);

    Controller *controller = nullptr;
    bool started = false;
};

#endif // GAGGIMATE_MATTER

#endif // MATTERPLUGIN_H
