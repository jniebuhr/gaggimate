#include "BoilerFillPlugin.h"
#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/core/process/PumpProcess.h>

void BoilerFillPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:ready", [this](Event const &) {
        this->controller->startProcess(
            new PumpProcess(ProcessTarget::TIME, this->controller->getSettings().getStartupFillTime(), 0.0));
    });
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        int newMode = event.getInt("value");
        if (newMode == MODE_BREW && this->controller->getMode() == MODE_STEAM) {
            this->controller->startProcess(
                new PumpProcess(ProcessTarget::TIME, this->controller->getSettings().getSteamFillTime(), 0.0));
        }
    });
}