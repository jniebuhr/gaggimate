#include "SmartGrindPlugin.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WiFi.h>

void SmartGrindPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:grind:end", [this](Event const &event) { stop(); });
}

void SmartGrindPlugin::stop() {
    Settings &settings = controller->getSettings();
    controlRelay(COMMAND_OFF);
    if (settings.isSmartGrindToggle()) {
        delay(300);
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
