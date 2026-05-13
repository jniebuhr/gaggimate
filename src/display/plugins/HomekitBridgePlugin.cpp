#include "HomekitBridgePlugin.h"
#include "../core/Controller.h"
#include "../core/PluginManager.h"
#include "../core/constants.h"
#include <utility>
#include <Arduino.h>

// ==========================================
// Helper Classes Implementation
// ==========================================

// GaggiMatePowerSwitch
GaggiMatePowerSwitch::GaggiMatePowerSwitch(bridge_callback_t callback)
    : callback(std::move(callback)) {
    power = new Characteristic::On();
}

boolean GaggiMatePowerSwitch::update() {
    if (power->getVal() != power->getNewVal()) {
        bool newState = power->getNewVal();
        this->callback(HomekitAction::SWITCH_1_TOGGLE, newState);
        return true;
    }
    return false;
}

void GaggiMatePowerSwitch::setState(bool active) {
    if (power) power->setVal(active, true);
}

// GaggiMateSteamSwitch
GaggiMateSteamSwitch::GaggiMateSteamSwitch(bridge_callback_t callback)
    : callback(std::move(callback)) {
    power = new Characteristic::On();
}

boolean GaggiMateSteamSwitch::update() {
    if (power->getVal() != power->getNewVal()) {
        bool newState = power->getNewVal();
        this->callback(HomekitAction::SWITCH_2_TOGGLE, newState);
        return true;
    }
    return false;
}

void GaggiMateSteamSwitch::setState(bool active) {
    if (power) power->setVal(active, true);
}

// GaggiMateHeatingSensor
GaggiMateHeatingSensor::GaggiMateHeatingSensor() : Service::ContactSensor() {
    contactState = new Characteristic::ContactSensorState(0);
}

void GaggiMateHeatingSensor::setStability(bool isStable) {
    int targetVal = isStable ? 1 : 0; // 0 = contact detected/heating, 1 = open/ready

    if (contactState && contactState->getVal() != targetVal) {
        contactState->setVal(targetVal, true);
    }
}


// ==========================================
// Main Plugin Implementation
// ==========================================

HomekitBridgePlugin::HomekitBridgePlugin(String wifiSsid, String wifiPassword)
    : wifiSsid(std::move(wifiSsid)), wifiPassword(std::move(wifiPassword)) {
    // Init Atomics
    actionRequired.store(false);
    lastAction.store(HomekitAction::NONE);
    actionSwitch1State.store(false);
    actionSwitch2State.store(false);

    statusUpdateRequired.store(false);
    currentMachineMode.store(0);

    heatingUpdateRequired.store(false);
    isHeatingStable.store(false);
}

void HomekitBridgePlugin::setup(Controller *pluginController, PluginManager *pluginManager) {
    this->controller = pluginController;

    bool enablePower = pluginController->getSettings().isHkPowerEnabled();
    bool enableSteam = pluginController->getSettings().isHkSteamEnabled();
    bool enableSensor = pluginController->getSettings().isHkSensorEnabled();

    // Callback HomeKit -> Controller
    auto callback = [this](HomekitAction action, bool state) {
        if (action == HomekitAction::SWITCH_1_TOGGLE) {
            this->actionSwitch1State.store(state);
        } else if (action == HomekitAction::SWITCH_2_TOGGLE) {
            this->actionSwitch2State.store(state);
        }
        this->lastAction.store(action);
        this->actionRequired.store(true);
    };

    if (pluginManager == nullptr) return;

    pluginManager->on("controller:wifi:connect", [this, enablePower, enableSteam, enableSensor, callback](Event const &event) {
        int apMode = event.getInt("AP");
        if (apMode) return;
        if (homekitStarted) return;

        startHomekitBridge(enablePower, enableSteam, enableSensor, callback);
    });

    pluginManager->on("controller:mode:change", [this](Event const &e) {
        this->currentMachineMode.store(e.getInt("value"));
        this->statusUpdateRequired.store(true);
    });

    pluginManager->on("boiler:heating:stable", [this](Event const &e) {
        this->isHeatingStable.store(e.getInt("isStable") == 1);
        this->heatingUpdateRequired.store(true);
    });
}

void HomekitBridgePlugin::startHomekitBridge(bool enablePower, bool enableSteam, bool enableSensor,
                                             const bridge_callback_t &callback) {
    homekitStarted = true;
    homeSpan.setHostNameSuffix("");
    homeSpan.setPortNum(HOMEKIT_BRIDGE_HOMESPAN_PORT);

    homeSpan.begin(Category::Bridges, HOMEKIT_BRIDGE_DEVICE_NAME, this->controller->getSettings().getMdnsName().c_str());
    homeSpan.setWifiCredentials(wifiSsid.c_str(), wifiPassword.c_str());

    createBridgeAccessory();
    if (enablePower) {
        createPowerAccessory(callback);
    }
    if (enableSteam) {
        createSteamAccessory(callback);
    }
    if (enableSensor) {
        createHeatingSensorAccessory();
    }

    homeSpan.autoPoll();
}

void HomekitBridgePlugin::createBridgeAccessory() {
    new SpanAccessory(1);
    new Service::AccessoryInformation();
    new Characteristic::Identify();
}

void HomekitBridgePlugin::createPowerAccessory(const bridge_callback_t &callback) {
    new SpanAccessory(2);
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name("GaggiMate Power");
    powerSwitch = std::make_unique<GaggiMatePowerSwitch>(callback);
}

void HomekitBridgePlugin::createSteamAccessory(const bridge_callback_t &callback) {
    new SpanAccessory(3);
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name("GaggiMate Steam");
    steamSwitch = std::make_unique<GaggiMateSteamSwitch>(callback);
}

void HomekitBridgePlugin::createHeatingSensorAccessory() {
    new SpanAccessory(4);
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name("GaggiMate Heating Status");
    this->heatingSensor = std::make_unique<GaggiMateHeatingSensor>();
}

void HomekitBridgePlugin::loop() {
    if (controller == nullptr) return;

    // Thread-safe sync: Machine -> HomeKit

    // A) Update Power / Steam Switches
    if (statusUpdateRequired.exchange(false)) {
        int newMode = currentMachineMode.load();

        // Only update if the object exists
        if (this->powerSwitch) {
            this->powerSwitch->setState(newMode != MODE_STANDBY);
        }
        if (this->steamSwitch) {
            this->steamSwitch->setState(newMode == MODE_STEAM);
        }
    }

    // B) Update Heating Sensor
    if (heatingUpdateRequired.exchange(false)) {
        bool stable = isHeatingStable.load();
        // Only update if the object exists
        if (this->heatingSensor) {
            this->heatingSensor->setStability(stable);
        }
    }

    // Action: HomeKit -> Controller
    if (actionRequired.load()) {
        HomekitAction currentAction = lastAction.load();
        bool s1 = actionSwitch1State.load();
        bool s2 = actionSwitch2State.load();

        if (currentAction == HomekitAction::SWITCH_1_TOGGLE) {
            if (s1) controller->deactivateStandby();
            else controller->activateStandby();
        } else if (currentAction == HomekitAction::SWITCH_2_TOGGLE) {
            if (s2) controller->setMode(MODE_STEAM);
            else {
                controller->deactivate();
                controller->setMode(MODE_BREW);
            }
        }
        this->clearAction();
    }
}

void HomekitBridgePlugin::clearAction() {
    actionRequired.store(false);
    lastAction.store(HomekitAction::NONE);
}
