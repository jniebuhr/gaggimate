#ifndef MDNSPLUGIN_H
#define MDNSPLUGIN_H
#include "../core/Plugin.h"

struct Event;

class mDNSPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override {
        // event-driven, nothing to poll
    }

  private:
    void start(Event const &event);
    void stop();

    Controller *controller = nullptr;
    bool responderRunning = false;
};

#endif // MDNSPLUGIN_H
