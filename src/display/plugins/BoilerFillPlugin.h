#ifndef BOILERFILLPLUGIN_H
#define BOILERFILLPLUGIN_H

#include <display/core/Plugin.h>

struct Event;

class BoilerFillPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    bool usePressureFill() const;
    bool startFillProcess(bool startup);

    Controller *controller = nullptr;
    bool steamFillPending = false;
};

#endif // BOILERFILLPLUGIN_H
