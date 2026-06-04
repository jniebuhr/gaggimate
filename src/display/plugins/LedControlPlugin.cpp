#include "LedControlPlugin.h"
#include <display/core/Controller.h>
#include <display/core/Event.h>

void LedControlPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:ready", [this](Event const) { initialized = true; });
}

void LedControlPlugin::loop() {
    if (!initialized) {
        return;
    }
    if (lastUpdate + UPDATE_INTERVAL < millis()) {
        lastUpdate = millis();
        updateControl();
    }
}

void LedControlPlugin::updateControl() {
    Settings settings = this->controller->getSettings();
    int mode = this->controller->getMode();
    if (mode == MODE_STANDBY) {
        sendControl(0, 0, 0, 0, 0);
        return;
    }
    if (this->controller->isActive() && mode == MODE_BREW) {
        sendControl(0, 0, 255, 20, settings.getSunriseExtBrightness());
        return;
    }
    if (this->controller->getLastProcess() != nullptr && this->controller->getLastProcess()->getType() == MODE_BREW &&
        mode == MODE_BREW) {
        sendControl(0, 255, 0, 20, settings.getSunriseExtBrightness());
        return;
    }
    if (this->controller->isLowWaterLevel()) {
        sendControl(255, 0, 0, 20, settings.getSunriseExtBrightness());
        return;
    }
    sendControl(settings.getSunriseR(), settings.getSunriseG(), settings.getSunriseB(), settings.getSunriseW(),
                settings.getSunriseExtBrightness());
}

void LedControlPlugin::sendControl(uint8_t r, uint8_t g, uint8_t b, uint8_t w, uint8_t ext) {
    if (r == last_r && g == last_g && b == last_b && w == last_w && ext == last_ext)
        return;

    // Send every channel as one snapshot. A single message keeps the outbound
    // coalescing queue from collapsing per-channel updates down to one channel.
    const uint8_t extInv = 255 - ext;
    const LedChannelCommand channels[] = {
        {0, r}, {1, g}, {2, b}, {3, w}, {4, extInv}, {5, extInv}, {6, extInv}, {7, extInv},
    };
    this->controller->getClientController()->sendLedControl(channels, sizeof(channels) / sizeof(channels[0]));

    last_r = r;
    last_g = g;
    last_b = b;
    last_w = w;
    last_ext = ext;
}
