#include "mDNSPlugin.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include <ESPmDNS.h>
#include <WiFi.h>
#include <esp_log.h>
#include <version.h>

static constexpr char LOG_TAG[] = "mDNSPlugin";

void mDNSPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:wifi:connect", [this](Event const &event) { start(event); });
    pluginManager->on("controller:wifi:disconnect", [this](Event const &) { stop(); });
}

void mDNSPlugin::start(Event const &event) {
    const int apMode = event.getInt("AP");
    if (apMode)
        return;

    // Defensively tear down any prior responder before starting a new one.
    // Without this, every WiFi reconnect leaks the previous mDNS records —
    // the underlying ESPmDNS state ends up with stale entries and clients
    // can no longer resolve `<hostname>.local` even though the device is
    // back on the network and the IP is reachable directly. Pairs with the
    // controller:wifi:disconnect handler installed in setup().
    if (responderRunning) {
        MDNS.end();
        responderRunning = false;
    }

    const String hostname = controller->getSettings().getMdnsName();
    if (!MDNS.begin(hostname.c_str())) {
        ESP_LOGE(LOG_TAG, "Error setting up mDNS responder");
        return;
    }

    // Advertise HTTP service for web interface
    MDNS.addService("http", "tcp", 80);

    // Advertise custom gaggimate service for Home Assistant discovery
    MDNS.addService("gaggimate", "tcp", 80);

    // Add service metadata as TXT records
    MDNS.addServiceTxt("gaggimate", "tcp", "version", BUILD_GIT_VERSION);
    MDNS.addServiceTxt("gaggimate", "tcp", "type", "espresso_machine");

    responderRunning = true;
    ESP_LOGI(LOG_TAG, "mDNS responder started with service advertisement (hostname=%s)", hostname.c_str());
}

void mDNSPlugin::stop() {
    if (!responderRunning)
        return;
    MDNS.end();
    responderRunning = false;
    ESP_LOGI(LOG_TAG, "mDNS responder stopped (wifi disconnected)");
}
