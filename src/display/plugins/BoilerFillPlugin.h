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
    bool steamFillEligible() const;

    Controller *controller = nullptr;
    bool startupFillPending = false;
    bool steamFillPending = false;
};

#endif // BOILERFILLPLUGIN_H
