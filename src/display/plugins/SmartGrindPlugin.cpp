#include "SmartGrindPlugin.h"
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Event.h>

void SmartGrindPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:grind:start", [this](Event const &event) { start(); });
    pluginManager->on("controller:grind:end", [this](Event const &event) { stop(); });
}

void SmartGrindPlugin::start() {
    const Settings &settings = this->controller->getSettings();
    if (settings.getSmartGrindMode() == SG_MODE_ON_OFF) {
        controlRelay(true);
    }
}

void SmartGrindPlugin::stop() {
    const Settings &settings = controller->getSettings();
    controlRelay(false);
    if (settings.getSmartGrindMode() == SG_MODE_OFF_ON) {
        delay(500);
        controlRelay(true);
    }
}

void SmartGrindPlugin::controlRelay(bool on) {
    const Settings &settings = controller->getSettings();
    const int type = settings.getSmartGrindType();
    String url;
    int method = SG_METHOD_GET;

    switch (type) {
    case SG_TYPE_ESPHOME: {
        const String switchId = settings.getSmartGrindSwitchId();
        if (!switchId.isEmpty()) {
            url = "http://" + settings.getSmartGrindIp() + "/switch/" + switchId + (on ? "/turn_on" : "/turn_off");
        }
        method = SG_METHOD_POST;
        break;
    }
    case SG_TYPE_CUSTOM: {
        url = on ? settings.getSmartGrindUrlOn() : settings.getSmartGrindUrlOff();
        method = settings.getSmartGrindMethod();
        break;
    }
    case SG_TYPE_TASMOTA:
    default: {
        url = "http://" + settings.getSmartGrindIp() + "/cm?cmnd=" + (on ? "Power%20On" : "Power%20Off");
        method = SG_METHOD_GET;
        break;
    }
    }

    if (url.isEmpty()) {
        printf("SmartGrind: plug type %d has no switch ID or URL set\n", type);
        return;
    }

    HTTPClient http;
    http.begin(url);
    int responseCode;
    if (method == SG_METHOD_POST) {
        responseCode = http.POST(static_cast<uint8_t *>(nullptr), 0);
    } else {
        responseCode = http.GET();
    }
    if (responseCode < 200 || responseCode >= 300) {
        printf("SmartGrind: %s %s -> HTTP %d\n", method == SG_METHOD_POST ? "POST" : "GET", url.c_str(), responseCode);
    }
    http.end();
}
