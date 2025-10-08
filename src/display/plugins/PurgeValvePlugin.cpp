#include "PurgeValvePlugin.h"
// #include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Event.h>

const String LOG_TAG = F("PurgeValvePlugin");



void PurgeValvePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    _controller = controller;
    pluginManager->on("controller:brew:end", [this](Event const &) {
        ESP_LOGI(LOG_TAG, "Brew end");
        _last_brew_finished = millis();
        _brew_finished = true;
    });
    pluginManager->on("controller:brew:start", [this](Event const &) {
        ESP_LOGI(LOG_TAG, "Brew start");
        _brew_started = true;
    });
}

void PurgeValvePlugin::loop() {
    if (!_is_purging && _brew_started && _brew_finished) {
        _controller->getClientController()->sendAltControl(true);
        _is_purging = true;
    }

    if (_is_purging && millis() > _last_brew_finished + PURGE_TIME_MS) {
        _controller->getClientController()->sendAltControl(false);
        _is_purging = false;
        _brew_started = false;
        _brew_finished = false;
    }
}
