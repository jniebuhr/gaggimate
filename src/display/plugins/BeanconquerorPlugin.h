#ifndef BEANCONQUERORPLUGIN_H
#define BEANCONQUERORPLUGIN_H

#include "../core/Plugin.h"
#include <NimBLEDevice.h>

#define BC_SERVICE_UUID        "4FAFC201-1FB5-459E-8FCC-C5C9C331914B"
#define BC_SHOT_DATA_CHAR_UUID "BEB5483E-36E1-4688-B7F5-EA07361B26A8"

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
