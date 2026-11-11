#include "LedControlPlugin.h"
#include <algorithm>
#include <display/core/Controller.h>
#include <display/core/Event.h>
#include <display/util/ColorConversion.h>

void LedControlPlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        forceSend = true;
    });
    pluginManager->on("controller:bluetooth:disconnect", [this](Event const &) {
        forceSend = true;
    });
    pluginManager->on("controller:state:resend", [this](Event const &) { forceSend = true; });
}

void LedControlPlugin::loop() {
    if (!controller->getClientController()->isConnected() || controller->getSystemInfo().protocolMismatch)
        return;
    const auto now = millis();
    if (forceSend || now - lastUpdate >= 100) {
        lastUpdate = now;
        updateControl();
    }
}

void LedControlPlugin::updateControl() {
    const Settings &settings = controller->getSettings();
    const auto &caps = controller->getSystemInfo().capabilities;
    const int mode = controller->getMode();
    const bool awake = mode != MODE_STANDBY;
    const bool brewing = awake && mode == MODE_BREW && controller->isActive();
    std::array<LedChannelCommand, 10> channels{};
    size_t count = 0;
    if (caps.ledControl) {
        String color = settings.getSunriseIdle();
        if (brewing) {
            color = settings.getSunriseActive();
        } else {
            bool lastWasBrew;
            {
                std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
                Process *last = controller->getLastProcess();
                lastWasBrew = last != nullptr && last->getType() == MODE_BREW;
            }
            if (lastWasBrew && mode == MODE_BREW)
                color = settings.getSunriseFinished();
            else if (controller->isLowWaterLevel() || controller->isErrorState())
                color = settings.getSunriseError();
        }
        const auto rgbw = awake ? ColorConversion::fromHex(color) : ColorConversion::Rgbw{};
        const uint8_t ext = 255 - (awake ? settings.getSunriseExtBrightness() : 0);
        channels[count++] = {0, rgbw.r};
        channels[count++] = {1, rgbw.g};
        channels[count++] = {2, rgbw.b};
        channels[count++] = {3, rgbw.w};
        for (uint8_t i = 4; i < 8; ++i)
            channels[count++] = {i, ext};
    }
    if (caps.dualBoiler) {
        const bool brewProcessActive = awake && controller->isBrewActive();
        auto addLight = [&](uint8_t channel, LightBehaviour &state, int function, uint8_t brightness, uint8_t minimum, uint16_t cycleTimeMs) {
            const bool brew = function == 2 || function == 6;
            const float target = brew ? controller->getTargetTemp() : controller->getTargetSteamTemp();
            const float temperature = brew ? controller->getCurrentTemp() : controller->getCurrentSteamTemp();
            const bool stable = brew && controller->getWarnings().isTemperatureStable();
            channels[count++] = {channel, function == 0 ? uint8_t{0} : brightness,
                                 state.update(function, temperature, target, stable, awake, brewProcessActive),
                                 function == 0 ? uint8_t{0} : minimum, cycleTimeMs};
        };
        addLight(SYSTEM_LED_CHANNEL, systemLight, settings.getSystemLedFunction(), settings.getSystemLedBrightness(),
                 settings.getSystemLedMinBrightness(), settings.getSystemLedCycleTimeMs());
        addLight(BARISTA_LED_CHANNEL, baristaLight, settings.getBaristaLedFunction(), settings.getBaristaLedBrightness(),
                 settings.getBaristaLedMinBrightness(), settings.getBaristaLedCycleTimeMs());
    }
    const bool force = forceSend.exchange(false);
    if (count == 0 || (!force && count == lastCount &&
                       std::equal(channels.begin(), channels.begin() + count, lastChannels.begin())))
        return;
    controller->getClientController()->sendLedControl(channels.data(), count);
    lastChannels = channels;
    lastCount = count;
}
