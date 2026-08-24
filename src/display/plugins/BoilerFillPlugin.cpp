#include "BoilerFillPlugin.h"
#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/core/process/PumpProcess.h>

void BoilerFillPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:ready", [this](Event const &) {
        this->controller->startProcess(new PumpProcess(this->controller->getSettings().getStartupFillTime()));
    });
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        if (this->controller->getMode() == MODE_STEAM) {
            this->controller->startProcess(new PumpProcess(this->controller->getSettings().getSteamFillTime()));
        }
    });
    // Main Menu load event handler
    pluginManager->on("ui:screen:menu", [this](Event const &) {
        // If mode is STEAM and refill on startup is 0 start refill on main menu to avoid starting with empty boiler
        if (this->controller->getSettings().getStartupFillTime() == 0 && this->controller->getMode() == MODE_STEAM) {
             this->controller->startProcess(new PumpProcess(this->controller->getSettings().getSteamFillTime()));
        }
    });
}
