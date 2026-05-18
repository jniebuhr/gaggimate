#ifndef BEANCONQUERORPLUGIN_H
#define BEANCONQUERORPLUGIN_H

#include "../core/Plugin.h"
#include <NimBLEDevice.h>

#define BC_SERVICE_UUID        "777b5132-9f56-4850-a14b-34c8df44901a"
#define BC_SHOT_DATA_CHAR_UUID "11282dae-6e9c-4223-b6d7-c67878832826"

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
