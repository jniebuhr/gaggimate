#ifndef HOMEKITPLUGIN_H
#define HOMEKITPLUGIN_H

#include "../core/Plugin.h"
#include <Arduino.h>
#include <memory>

// HomeSpan 2.x defines a global `class Controller`; keep all HomeSpan types
// behind a PImpl so its header never pollutes ours.
class HomekitPlugin : public Plugin {
  public:
    HomekitPlugin(String wifiSsid, String wifiPassword);
    ~HomekitPlugin() override;
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    bool hasAction() const;
    void clearAction();

  private:
    struct Impl;
    std::unique_ptr<Impl> impl;
};

#endif // HOMEKITPLUGIN_H
