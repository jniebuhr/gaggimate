#include "BoilerFillPlugin.h"
#include "../core/Controller.h"
#include "../core/Event.h"
#include <WiFi.h>

void BoilerFillPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:ready", [this](Event const &event) {
        this->controller->startProcess(new PumpProcess(this->controller->getSettings().getStartupFillTime()));
    });
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        int newMode = event.getInt("value");
        if (newMode == MODE_BREW && this->controller->getMode() == MODE_STEAM) {
            this->controller->startProcess(new PumpProcess(this->controller->getSettings().getSteamFillTime()));
        }
    });
}
