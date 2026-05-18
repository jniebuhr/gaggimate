#ifndef BEANCONQUERORPLUGIN_H
#define BEANCONQUERORPLUGIN_H

#include "../core/Plugin.h"
#include <NimBLEDevice.h>

#define BC_SERVICE_UUID        "0000C001-0000-1000-8000-00805F9B34FB"
#define BC_SHOT_DATA_CHAR_UUID "0000C002-0000-1000-8000-00805F9B34FB"

constexpr unsigned long BC_NOTIFY_INTERVAL_BREW_MS = 100;   // 10 Hz
constexpr unsigned long BC_NOTIFY_INTERVAL_IDLE_MS = 1000;  // 1 Hz

class BeanconquerorPlugin : public Plugin {
  public:
    BeanconquerorPlugin();
    ~BeanconquerorPlugin() override = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void initBLEServer();
    void buildAndNotify();

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;

    NimBLEServer *server = nullptr;
    NimBLECharacteristic *shotDataChar = nullptr;

    bool bleReady = false;
    bool brewing = false;
    unsigned long lastNotify = 0;
};

#endif // BEANCONQUERORPLUGIN_H
