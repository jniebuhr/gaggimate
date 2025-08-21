#ifndef LEDCONTROLPLUGIN_H
#define LEDCONTROLPLUGIN_H
#include <Arduino.h>
#include <display/core/Plugin.h>

constexpr unsigned long UPDATE_INTERVAL = 500;

class LedControlPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop();

  private:
    void updateControl();
    void sendControl(uint8_t r, uint8_t g, uint8_t b, uint8_t w, uint8_t ext);

    unsigned long lastUpdate = 0;
    bool initialized = false;

    uint8_t last_r = -1;
    uint8_t last_g = -1;
    uint8_t last_b = -1;
    uint8_t last_w = -1;
    uint8_t last_ext = -1;

    Controller *controller = nullptr;
};

#endif // LEDCONTROLPLUGIN_H
