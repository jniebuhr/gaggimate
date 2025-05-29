#ifndef PLUGIN_H
#define PLUGIN_H

class PluginManager;
class Controller;
class Plugin {
  public:
    virtual ~Plugin() = default;

    virtual void setup(Controller *controller, PluginManager *pluginManager) = 0;
    virtual void loop() = 0;
};

#endif // PLUGIN_H
