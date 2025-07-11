#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "esp_wifi.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include <display/core/PluginManager.h>

const IPAddress WIFI_AP_IP(4, 4, 4, 1); // the IP address the web server, Samsung requires the IP to be in public space
const IPAddress WIFI_SUBNET_MASK(255, 255, 255, 0); // no need to change: https://avinetworks.com/glossary/subnet-mask/

class WifiManager {
public:
    struct WiFiConfig {
        String ssid;
        String password;
        String apSSID;
        String apPassword;
        uint32_t apTimeoutMs;

        WiFiConfig(const char* wifi_ssid = "",
                  const char* wifi_password = "",
                  const char* ap_ssid = "GaggiMate",
                  const char* ap_password = "",
                  uint32_t ap_timeout_ms = 10 * 60 * 1000)  // 5 minutes default
            : ssid(wifi_ssid)
            , password(wifi_password)
            , apSSID(ap_ssid)
            , apPassword(ap_password)
            , apTimeoutMs(ap_timeout_ms) {}
    };

private:
    static const uint8_t MAX_CONNECTION_ATTEMPTS = 6;
    static const uint32_t RECONNECT_DELAY_MS = 5000;  // 5 seconds between reconnection attempts

    WiFiConfig config;
    bool isAPActive = false;
    uint32_t apStartTime = 0;
    TaskHandle_t wifiTaskHandle = nullptr;
    bool shouldReconnect = false;
    PluginManager *pluginManager;

    EventGroupHandle_t wifiEventGroup;
    static const int WIFI_CONNECTED_BIT = BIT0;
    static const int WIFI_FAIL_BIT = BIT1;
    static const int WIFI_RECONNECT_BIT = BIT2;

    bool hasCredentials() const;
    void startConnection() const;
    static void wifiEventHandler(void* arg, esp_event_base_t event_base,
                                 int32_t event_id, void* event_data);
    static void wifiTask(void* parameter);

public:
    WifiManager(PluginManager *pm, const WiFiConfig& initial_config = WiFiConfig())
        : config(initial_config), pluginManager(pm) {
        wifiEventGroup = xEventGroupCreate();
    }

    void begin();

    // Configuration methods
    void reconfigure(const WiFiConfig& new_config);
    void updateCredentials(const char* new_ssid, const char* new_password);
    void updateAPConfig(const char* ap_ssid, const char* ap_password, uint32_t timeout_ms);
    void startAP();
    void stopAP();
    bool isConnected() {
        return WiFi.status() == WL_CONNECTED;
    }
    bool isAccessPointActive() {
        return isAPActive;
    }
    String getLocalIP() {
        return WiFi.localIP().toString();
    }
    String getAPIP() {
        return WiFi.softAPIP().toString();
    }
    const WiFiConfig& getCurrentConfig() const {
        return config;
    }
};

#endif
