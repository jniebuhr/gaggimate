#include "WifiManager.h"

bool WifiManager::hasCredentials() const { return !config.ssid.isEmpty() && !config.password.isEmpty(); }

void WifiManager::startConnection() const {
    if (hasCredentials()) {
        ESP_LOGI("WifiManager", "Attempting to connect to %s\n", config.ssid.c_str());
        WiFi.begin(config.ssid.c_str(), config.password.c_str());
    } else {
        ESP_LOGI("WifiManager", "No credentials stored - starting AP mode");
        xEventGroupSetBits(wifiEventGroup, WIFI_FAIL_BIT);
    }
}

void WifiManager::wifiEventHandler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data) {
    WifiManager *manager = static_cast<WifiManager *>(arg);

    if (event_base == WIFI_EVENT) {
        switch (event_id) {
        case WIFI_EVENT_STA_DISCONNECTED: {
            wifi_event_sta_disconnected_t *event = (wifi_event_sta_disconnected_t *)event_data;
            ESP_LOGI("WifiManager", "WiFi disconnected. Reason: %d\n", event->reason);
            xEventGroupClearBits(manager->wifiEventGroup, WIFI_CONNECTED_BIT);
            xEventGroupSetBits(manager->wifiEventGroup, WIFI_FAIL_BIT);
            manager->pluginManager->trigger("controller:wifi:disconnect");
            break;
        }
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI("WifiManager", "Got IP: " IPSTR "\n", IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(manager->wifiEventGroup, WIFI_CONNECTED_BIT);
        xEventGroupClearBits(manager->wifiEventGroup, WIFI_FAIL_BIT);
        manager->pluginManager->trigger("controller:wifi:connect", "AP", 0);
        if (manager->isAPActive) {
            manager->stopAP();
        }
    }
}

void WifiManager::wifiTask(void *parameter) {
    WifiManager *manager = static_cast<WifiManager *>(parameter);
    uint8_t attempts = 0;
    TickType_t lastConnectionAttempt = 0;

    // If no credentials, start AP immediately
    if (!manager->hasCredentials()) {
        manager->startAP();
    }

    while (true) {
        // Check if we need to reconnect with new credentials
        if (xEventGroupGetBits(manager->wifiEventGroup) & WIFI_RECONNECT_BIT) {
            WiFi.disconnect(true);
            vTaskDelay(pdMS_TO_TICKS(1000));
            manager->startConnection();
            attempts = 0;
            lastConnectionAttempt = xTaskGetTickCount();
            xEventGroupClearBits(manager->wifiEventGroup, WIFI_RECONNECT_BIT);
        }

        // Always try to connect if we have credentials and aren't connected
        if (manager->hasCredentials() && WiFi.status() != WL_CONNECTED) {
            // Check if it's time for next connection attempt
            if (xTaskGetTickCount() - lastConnectionAttempt >= pdMS_TO_TICKS(RECONNECT_DELAY_MS)) {
                ESP_LOGI("WifiManager", "Attempting to connect to %s (Attempt %d)\n", manager->config.ssid.c_str(), attempts + 1);

                // Start AP after certain number of failures if not already active
                if (attempts >= MAX_CONNECTION_ATTEMPTS && !manager->isAPActive) {
                    manager->startAP();
                }

                // Try to connect regardless of AP state
                WiFi.setTxPower(WIFI_POWER_19_5dBm);
                esp_wifi_connect();
                attempts++;
                lastConnectionAttempt = xTaskGetTickCount();
            }
        }

        // Handle connection state
        if (WiFi.status() == WL_CONNECTED) {
            if (!xEventGroupGetBits(manager->wifiEventGroup) & WIFI_CONNECTED_BIT) {
                // Just connected
                xEventGroupSetBits(manager->wifiEventGroup, WIFI_CONNECTED_BIT);
                xEventGroupClearBits(manager->wifiEventGroup, WIFI_FAIL_BIT);
                attempts = 0;
                manager->pluginManager->trigger("controller:wifi:connect", "AP", manager->isAPActive ? 1 : 0);
            }

            // If connected and AP is active, check timeout
            if (manager->isAPActive && manager->config.apTimeoutMs > 0 &&
                (millis() - manager->apStartTime >= manager->config.apTimeoutMs)) {
                manager->stopAP();
            }
        } else {
            // Not connected
            if (xEventGroupGetBits(manager->wifiEventGroup) & WIFI_CONNECTED_BIT) {
                // Just disconnected
                xEventGroupClearBits(manager->wifiEventGroup, WIFI_CONNECTED_BIT);
                xEventGroupSetBits(manager->wifiEventGroup, WIFI_FAIL_BIT);
                manager->pluginManager->trigger("controller:wifi:disconnect");
            }
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void WifiManager::begin() {
    // Initialize WiFi
    WiFi.mode(WIFI_MODE_APSTA);
    WiFi.disconnect(true);

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;

    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifiEventHandler, this, &instance_any_id);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifiEventHandler, this, &instance_got_ip);

    if (hasCredentials()) {
        startConnection();
    }

    // Create WiFi management task
    xTaskCreate(wifiTask, "WifiManager", 4096, this, 1, &wifiTaskHandle);
}

void WifiManager::reconfigure(const WiFiConfig &new_config) {
    config = new_config;
    xEventGroupSetBits(wifiEventGroup, WIFI_RECONNECT_BIT);
}

void WifiManager::updateCredentials(const char *new_ssid, const char *new_password) {
    config.ssid = new_ssid;
    config.password = new_password;
    xEventGroupSetBits(wifiEventGroup, WIFI_RECONNECT_BIT);
}

void WifiManager::updateAPConfig(const char *ap_ssid, const char *ap_password, uint32_t timeout_ms) {
    config.apSSID = ap_ssid;
    config.apPassword = ap_password;
    config.apTimeoutMs = timeout_ms;

    // If AP is active, restart it with new configuration
    if (isAPActive) {
        stopAP();
        startAP();
    }
}

void WifiManager::startAP() {
    if (!isAPActive) {
        ESP_LOGI("WifiManager", "Starting AP mode");

        WiFi.softAPConfig(WIFI_AP_IP, WIFI_AP_IP, WIFI_SUBNET_MASK);
        WiFi.softAP(config.apSSID.c_str(), config.apPassword.c_str());
        WiFi.setTxPower(WIFI_POWER_19_5dBm);
        isAPActive = true;
        apStartTime = millis();
        ESP_LOGI("WifiManager", "AP '%s' started. Will timeout in %d seconds\n", config.apSSID.c_str(),
                 config.apTimeoutMs / 1000);

        pluginManager->trigger("controller:wifi:connect", "AP", 1);
    }
}

void WifiManager::stopAP() {
    if (isAPActive) {
        ESP_LOGI("WifiManager", "Stopping AP mode");
        WiFi.softAPdisconnect(true);
        isAPActive = false;
        pluginManager->trigger("controller:wifi:disconnect");
    }
}
