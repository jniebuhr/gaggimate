#include "NetworkWatchdogPlugin.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include "../core/constants.h" // MODE_STANDBY
#include <WiFi.h>
#include <esp_heap_caps.h>
#include <esp_log.h>

static constexpr char LOG_TAG[] = "NetWatchdog";

void NetworkWatchdogPlugin::setup(Controller *c, PluginManager *pluginManager) {
    this->controller = c;
    pluginManager->on("controller:wifi:connect", [this](Event const &) {
        _probe.begin(0);
        _socketReady = true;
        const unsigned long now = millis();
        _lastAlive = now;
        _lastProbe = now;
        _lastStats = now;
        _stage = 0;
        ESP_LOGI(LOG_TAG, "Watchdog started (wifi connected)");
    });
    pluginManager->on("controller:wifi:disconnect", [this](Event const &) {
        ESP_LOGI(LOG_TAG, "Watchdog stopped (wifi disconnected)");
        // _probe.stop();
        _socketReady = false;
    });
}

bool NetworkWatchdogPlugin::networkShouldBeUp() const {
    const wifi_mode_t mode = WiFi.getMode();
    if (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA)
        return true;
    return WiFi.status() == WL_CONNECTED;
}

bool NetworkWatchdogPlugin::probeEgress() {
    const wifi_mode_t mode = WiFi.getMode();
    const bool ap = (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);
    IPAddress target = ap ? WiFi.softAPIP() : WiFi.gatewayIP();
    if (static_cast<uint32_t>(target) == 0)
        return true;
    if (_probe.beginPacket(target, PROBE_PORT) != 1)
        return false;
    _probe.write(static_cast<uint8_t>(0));
    return _probe.endPacket() == 1;
}

void NetworkWatchdogPlugin::logStats(const char *reason) {
    const unsigned freeInt = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
    const unsigned minInt = heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL);
    const unsigned largestInt = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    const unsigned long sinceOk = millis() - _lastAlive;
    ESP_LOGI(LOG_TAG, "[%s] internal heap: free=%u min=%u largest=%u | egress ok %lus ago (stage %u)", reason, freeInt, minInt,
             largestInt, sinceOk / 1000, _stage);
}

bool NetworkWatchdogPlugin::rebootAllowed(unsigned long now) const {
    if (now < MIN_UPTIME_FOR_REBOOT)
        return false;
    if (_standbySince == 0)
        return false;
    if (now - _standbySince < MIN_STANDBY_FOR_REBOOT)
        return false;
    return true;
}

void NetworkWatchdogPlugin::recover(unsigned long now, unsigned long deadForMs) {
    if (_stage < 1) {
        _stage = 1;
        logStats("egress-dead");
        ESP_LOGE(LOG_TAG, "No network egress for %lus while WiFi up -> WiFi reconnect", deadForMs / 1000);
        const wifi_mode_t mode = WiFi.getMode();
        if (mode == WIFI_MODE_STA || mode == WIFI_MODE_APSTA)
            WiFi.reconnect();
        return;
    }

    if (deadForMs < REBOOT_AFTER)
        return;

    if (!rebootAllowed(now)) {
        if (!_rebootHeld) {
            _rebootHeld = true;
            ESP_LOGW(LOG_TAG, "Network dead but deferring reboot (needs uptime > 15min and standby > 5min)");
        }
        return;
    }

    ESP_LOGE(LOG_TAG, "Network still dead after %lus and machine idle -> rebooting to reclaim the stack", deadForMs / 1000);
    logStats("egress-dead-reboot");
    delay(50);
    ESP.restart();
}

void NetworkWatchdogPlugin::loop() {
    const unsigned long now = millis();

    if (controller != nullptr && controller->getMode() == MODE_STANDBY) {
        if (_standbySince == 0)
            _standbySince = now;
    } else {
        _standbySince = 0;
    }

    if (!_socketReady || !networkShouldBeUp()) {
        _lastAlive = now;
        _stage = 0;
        _rebootHeld = false;
        return;
    }

    if (now - _lastStats >= STATS_PERIOD) {
        _lastStats = now;
        logStats("periodic");
    }

    if (now - _lastProbe >= PROBE_PERIOD) {
        _lastProbe = now;
        if (probeEgress()) {
            if (_stage != 0)
                ESP_LOGW(LOG_TAG, "Network egress recovered");
            _lastAlive = now;
            _stage = 0;
            _rebootHeld = false;
        }
    }

    const unsigned long deadFor = now - _lastAlive;
    if (deadFor >= DEAD_AFTER)
        recover(now, deadFor);
}
