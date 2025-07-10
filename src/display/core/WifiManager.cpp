#include "WifiManager.h"
#include <display/config.h>
#include <display/core/constants.h>
#include <display/core/zones.h>
#include <esp_log.h>

static const char *TAG = "WifiManager";

void WifiManager::setup(Settings *s, PluginManager *pm) {
    settings = s;
    pluginManager = pm;

    WiFi.mode(WIFI_OFF);
    eventId = WiFi.onEvent([this](WiFiEvent_t event, WiFiEventInfo_t info) { handleEvent(event, info); });

    xTaskCreatePinnedToCore(loopTask, "WifiManager::loop", 4096, this, 1, &taskHandle, 1);
}

void WifiManager::handleEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
    switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
        ESP_LOGI(TAG, "Connected with IP %s", WiFi.localIP().toString().c_str());
        connected = true;
        connecting = false;
        configTzTime(resolve_timezone(settings->getTimezone()), NTP_SERVER);
        pluginManager->trigger("controller:wifi:connect", "AP", apActive ? 1 : 0);
        break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
        if (connected) { // If we weren't connected previously this is a connection reject
            disconnect();
        }
        break;
    default:
        break;
    }
}

void WifiManager::connect() {
    if (settings->getWifiSsid() == "" || settings->getWifiPassword() == "") {
        startAccessPoint();
        return;
    }
    WiFi.mode(apActive ? WIFI_AP_STA : WIFI_STA);
    WiFi.begin(settings->getWifiSsid().c_str(), settings->getWifiPassword().c_str());
    WiFi.setTxPower(WIFI_POWER_19_5dBm);
    connecting = true;
    connectStart = millis();
}

void WifiManager::disconnect() {
    ESP_LOGI(TAG, "Disconnected from WiFi");
    WiFi.disconnect();
    connecting = false;
    connected = false;
    pluginManager->trigger("controller:wifi:disconnect");
}

void WifiManager::startAccessPoint() {
    if (apActive || apStarted)
        return;
    WiFi.disconnect();
    ESP_LOGI(TAG, "Starting access point");
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAPConfig(WIFI_AP_IP, WIFI_AP_IP, WIFI_SUBNET_MASK);
    WiFi.softAP(WIFI_AP_SSID);
    WiFi.setTxPower(WIFI_POWER_19_5dBm);
    apStart = millis();
    apActive = true;
    apStarted = true;
    pluginManager->trigger("controller:wifi:connect", "AP", 1);
}

void WifiManager::stopAccessPoint() {
    if (!apActive)
        return;
    ESP_LOGI(TAG, "Stopping access point");
    WiFi.softAPdisconnect(true);
    apActive = false;
    pluginManager->trigger("controller:wifi:disconnect");
}

void WifiManager::loopTask(void *arg) {
    auto *manager = static_cast<WifiManager *>(arg);
    manager->connect();
    while (true) {
        manager->loop();
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}

void WifiManager::loop() {
    unsigned long now = millis();

    if (connected && WiFi.SSID() != settings->getWifiSsid()) {
        disconnect();
    }

    if (!hasCredentials() || (!connected && connecting && now - connectStart > WIFI_CONNECT_TIMEOUT_MS)) {
        startAccessPoint();
        connecting = false;
    }

    if (!connected && !connecting && !apActive) {
        connect();
    }

    if (apActive && (apStart + settings->getWifiApTimeout() < now)) {
        ESP_LOGI(TAG, "Access point timeout");
        stopAccessPoint();
    }
}

bool WifiManager::hasCredentials() const { return settings->getWifiSsid() != "" && settings->getWifiPassword() != ""; }
