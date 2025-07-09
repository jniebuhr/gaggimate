#include "mDNSPlugin.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include <ESPmDNS.h>
#include <WiFi.h>

void mDNSPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:wifi:connect", [this](Event const &event) { start(event); });
    pluginManager->on("controller:wifi:disconnect", [](Event const &) { MDNS.end(); });
}
void mDNSPlugin::start(Event const &event) const {
    MDNS.end();
    const int apMode = event.getInt("AP");
    if (apMode)
        return;
    if (!MDNS.begin(controller->getSettings().getMdnsName().c_str())) {
        Serial.println("Error setting up MDNS responder!");
    }}