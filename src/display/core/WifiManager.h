#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "PluginManager.h"
#include "Settings.h"
#include <Arduino.h>
#include <WiFi.h>

const IPAddress WIFI_AP_IP(4, 4, 4, 1); // the IP address the web server, Samsung requires the IP to be in public space
const IPAddress WIFI_SUBNET_MASK(255, 255, 255, 0); // no need to change: https://avinetworks.com/glossary/subnet-mask/

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
    void connect();
    void disconnect();
    void startAccessPoint();
    void stopAccessPoint();
    void handleEvent(WiFiEvent_t event, WiFiEventInfo_t info);
    bool hasCredentials() const;
};

#endif // WIFI_MANAGER_H
