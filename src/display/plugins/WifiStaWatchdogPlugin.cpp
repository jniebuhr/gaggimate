#include "WifiStaWatchdogPlugin.h"
#include "../core/Controller.h"
#include "../core/Settings.h"
#include <WiFi.h>
#include <esp_log.h>
#include <esp_wifi.h>

static constexpr char LOG_TAG[] = "WifiStaWd";

void WifiStaWatchdogPlugin::setup(Controller *c, PluginManager *pluginManager) {
    controller = c;
    ssid = controller->getSettings().getWifiSsid();
    pass = controller->getSettings().getWifiPassword();
    armed = ssid.length() > 0 && pass.length() > 0;
    lastConnectedMs = millis();
    lastReassocMs = 0;

    // Suspend during OTA: a forced WiFi.begin() mid-download would brick the
    // pull.  NetworkWatchdog already gates its WiFi.reconnect() the same way.
    pluginManager->on("ota:update:start", [this](Event const &) { updating = true; });
    pluginManager->on("ota:update:end", [this](Event const &) { updating = false; });

    ESP_LOGI(LOG_TAG, "armed=%d grace=%lums backoff=%lums", armed, STA_DOWN_GRACE_MS, STA_REASSOC_BACKOFF_MS);
}

void WifiStaWatchdogPlugin::loop() {
    if (!armed || updating)
        return;

    // AP-fallback mode is its own world; setupWifi() lifted us here at boot
    // and there is no STA to recover.  Skip rather than thrash WiFi.begin().
    const wifi_mode_t mode = WiFi.getMode();
    if (mode == WIFI_MODE_AP || mode == WIFI_MODE_NULL)
        return;

    const unsigned long now = millis();
    if (WiFi.status() == WL_CONNECTED) {
        lastConnectedMs = now;
        return;
    }

    if (now - lastConnectedMs < STA_DOWN_GRACE_MS)
        return;
    if (lastReassocMs != 0 && now - lastReassocMs < STA_REASSOC_BACKOFF_MS)
        return;

    forceReassoc();
    lastReassocMs = now;
}

void WifiStaWatchdogPlugin::forceReassoc() {
    // The SDK's auto-reconnect path consults a fixed reason-code whitelist
    // (WiFiGeneric::_isReconnectableReason); on unlisted codes (UniFi vendor
    // 168, ASSOC_LEAVE, etc) it stops retrying entirely.  An explicit
    // disconnect+begin re-enters the connect path regardless of reason.
    wifi_ap_record_t ap{};
    const bool haveAp = esp_wifi_sta_get_ap_info(&ap) == ESP_OK;
    ESP_LOGW(LOG_TAG, "STA down %lums; forcing reconnect (status=%d)", millis() - lastConnectedMs, (int)WiFi.status());
    if (haveAp) {
        ESP_LOGW(LOG_TAG, "  last AP: bssid=%02x:%02x:%02x:%02x:%02x:%02x rssi=%d ch=%u", ap.bssid[0], ap.bssid[1], ap.bssid[2],
                 ap.bssid[3], ap.bssid[4], ap.bssid[5], ap.rssi, ap.primary);
    }

    WiFi.disconnect(false); // reset state machine, keep stored wifi_config_t
    delay(50);
    WiFi.begin(ssid.c_str(), pass.c_str());
}
