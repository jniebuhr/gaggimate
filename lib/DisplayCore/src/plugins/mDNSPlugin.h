#ifndef MDNSPLUGIN_H
#define MDNSPLUGIN_H
#include "../Plugin.h"

struct Event;

class mDNSPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {};

  private:
    void start(Event const &event) const;

    Controller *controller = nullptr;
};

#endif // MDNSPLUGIN_H
