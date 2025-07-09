#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "Settings.h"
#include "PluginManager.h"

class WifiManager {
  public:
    WifiManager() = default;
    void setup(Settings *settings, PluginManager *pluginManager);
    bool isApActive() const { return apActive; }

  private:
    Settings *settings = nullptr;
    PluginManager *pluginManager = nullptr;
    bool apActive = false;
    bool apStarted = false;
    bool connected = false;
    bool connecting = false;
    unsigned long connectStart = 0;
    unsigned long apStart = 0;
    WiFiEventId_t eventId = 0;
    TaskHandle_t taskHandle = nullptr;
    static void loopTask(void *arg);
    void loop();
    void connectToWifi();
    void startAccessPoint();
    void stopAccessPoint();
    void handleEvent(WiFiEvent_t event, WiFiEventInfo_t info);
};

#endif // WIFI_MANAGER_H
