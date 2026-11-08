#include "BoilerFillPlugin.h"
#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/core/process/PressureFillProcess.h>
#include <display/core/process/PumpProcess.h>

namespace {
constexpr float kFullPressureBar = 8.0f;
constexpr unsigned long kHoldMs = 1500;
constexpr unsigned long kMaxMs = 20000;
constexpr float kSteamWaitTempC = 100.0f;
} // namespace

bool BoilerFillPlugin::usePressureFill() const {
    if (controller == nullptr)
        return false;
    const auto caps = controller->getSystemInfo().capabilities;
    return caps.pressure && !caps.dualBoiler;
}

bool BoilerFillPlugin::startFillProcess(bool startup) {
    if (usePressureFill()) {
        return controller->startProcess(new PressureFillProcess([this]() { return this->controller->getCurrentPressure(); },
                                                                kFullPressureBar, kHoldMs, kMaxMs));
    }
    auto &settings = controller->getSettings();
    const int duration = startup ? settings.getStartupFillTime() : settings.getSteamFillTime();
    if (duration <= 0)
        return false;
    return controller->startProcess(new PumpProcess(duration));
}

void BoilerFillPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:ready", [this](Event const &) {
        // Pro: plugin on = always fill. Timed machines: 0 disables.
        if (!this->usePressureFill() && this->controller->getSettings().getStartupFillTime() == 0)
            return;
        if (!this->startFillProcess(true))
            this->startupFillPending = true;
    });
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        // Event fires before mode is assigned, so getMode() is still the previous mode.
        const int newMode = event.getInt("value");
        if (this->controller->getMode() != MODE_STEAM)
            return;
        if (newMode == MODE_STEAM)
            return;

        if (this->usePressureFill()) {
            // Defer until cool/idle; also covers steam → standby → wake.
            this->steamFillPending = true;
            return;
        }

        if (this->controller->getSettings().getSteamFillTime() == 0)
            return;
        if (newMode != MODE_STANDBY)
            this->startFillProcess(false);
    });
}

void BoilerFillPlugin::loop() {
    if (controller == nullptr)
        return;

    if (startupFillPending && controller->isReady() && !controller->isActive()) {
        if (startFillProcess(true))
            startupFillPending = false;
    }

    if (!steamFillPending)
        return;

    const int mode = controller->getMode();
    if (mode == MODE_STEAM || mode == MODE_STANDBY)
        return;
    if (!controller->isReady() || controller->isActive())
        return;
    if (controller->getCurrentTemp() >= kSteamWaitTempC)
        return;

    if (startFillProcess(false))
        steamFillPending = false;
}
