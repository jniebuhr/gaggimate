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
    Settings &settings = this->controller->getSettings();
    if (settings.getSmartGrindMode() == SG_MODE_ON_OFF) {
        controlRelay(COMMAND_ON);
    }
}

void SmartGrindPlugin::stop() {
    Settings &settings = controller->getSettings();
    controlRelay(COMMAND_OFF);
    if (settings.getSmartGrindMode() == SG_MODE_OFF_ON) {
        delay(500);
        controlRelay(COMMAND_ON);
    }
}

void SmartGrindPlugin::controlRelay(String command) {
    HTTPClient http;
    Settings &settings = controller->getSettings();
    String serverPath = "http://" + settings.getSmartGrindIp() + "/cm?cmnd=" + command;
    http.begin(serverPath);
    int responseCode = http.GET();
    if (responseCode != 200) {
        printf("Failed to switch Relay\n");
    }
}
