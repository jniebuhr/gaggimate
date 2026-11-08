#ifndef WIFISTAWATCHDOGPLUGIN_H
#define WIFISTAWATCHDOGPLUGIN_H

#include "../core/Plugin.h"
#include <Arduino.h>

struct Event;

// Force STA reassociation when arduino-esp32 auto-reconnect has stopped retrying.
// _isReconnectableReason() ignores vendor codes (UniFi 81, 168) and several
// 802.11 reasons, so the SDK can leave STA "disconnected" indefinitely.
// NetworkWatchdog only acts after WiFi is up; this covers the never-comes-back
// case.
class WifiStaWatchdogPlugin : public Plugin {
  public:
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    static constexpr unsigned long STA_DOWN_GRACE_MS = 20000;
    static constexpr unsigned long STA_REASSOC_BACKOFF_MS = 30000;

    Controller *controller = nullptr;
    String ssid;
    String pass;
    unsigned long lastConnectedMs = 0;
    unsigned long lastReassocMs = 0;
    bool armed = false;
    bool updating = false;

    void forceReassoc();
};

#endif // WIFISTAWATCHDOGPLUGIN_H
