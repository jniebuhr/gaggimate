#ifndef IMPROVPLUGIN_H
#define IMPROVPLUGIN_H

#include "../core/Plugin.h"
#include <Arduino.h>

class Controller;
class ImprovWiFi;

// Improv Wi-Fi provisioning over Serial (https://www.improv-wifi.com/serial/).
class ImprovPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    static bool onConnectWifi(const char *ssid, const char *password);
    static void onConnected(const char *ssid, const char *password);

    Controller *controller = nullptr;
    ImprovWiFi *improv = nullptr;
    bool rebootPending = false;

    // Backing strings for seteviceInfo (kept alive for the plugin's lifetime).
    String firmwareVersion;
    String deviceName;
    String deviceUrl;
};

#endif // IMPROVPLUGIN_H
