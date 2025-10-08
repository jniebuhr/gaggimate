#ifndef PURGEVALVELPLUGIN_H
#define PURGEVALVEPLUGIN_H

#include <display/core/Plugin.h>

#define PURGE_TIME_MS 1500

struct Event;

class PurgeValvePlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    Controller *_controller = nullptr;
    bool _brew_started = false;
    bool _brew_finished = false;
    bool _is_purging = false;
    unsigned long _last_brew_finished = 0;
};

#endif // PURGEVALVEPLUGIN_H
