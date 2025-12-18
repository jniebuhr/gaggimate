#include "HomekitBridgePlugin.h"
#include "../core/Controller.h"
#include "../core/PluginManager.h"
#include "../core/constants.h"
#include <utility>
#include <Arduino.h>

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
    int targetVal = isStable ? 1 : 0; // 1 = ready (closed)
    if (contactState && contactState->getVal() != targetVal) {
        contactState->setVal(targetVal, true);
    }
}


// Main Plugin Implementation

HomekitBridgePlugin::HomekitBridgePlugin(String wifiSsid, String wifiPassword) 
    : wifiSsid(std::move(wifiSsid)), wifiPassword(std::move(wifiPassword)) {
    actionRequired.store(false);
    lastAction.store(HomekitAction::NONE);
    actionSwitch1State.store(false);
    actionSwitch2State.store(false);
}

void HomekitBridgePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    auto callback = [this](HomekitAction action, bool state) {
        if (action == HomekitAction::SWITCH_1_TOGGLE) {
            this->actionSwitch1State.store(state);
        } else if (action == HomekitAction::SWITCH_2_TOGGLE) {
            this->actionSwitch2State.store(state);
        }
        this->lastAction.store(action); 
        this->actionRequired.store(true);
    };

    homeSpan.setHostNameSuffix("");
    homeSpan.setPortNum(HOMESPAN_PORT);

    homeSpan.begin(Category::Bridges, DEVICE_NAME, this->controller->getSettings().getMdnsName().c_str());
    homeSpan.setWifiCredentials(wifiSsid.c_str(), wifiPassword.c_str());

    // Bridge Info Accessory
    new SpanAccessory();
    new Service::AccessoryInformation();
    new Characteristic::Identify();

    // Power Accessory
    new SpanAccessory();
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name("GaggiMate Power");
    powerSwitch = new GaggiMatePowerSwitch(callback);

    // Steam Accessory
    new SpanAccessory();
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name("GaggiMate Steam");
    steamSwitch = new GaggiMateSteamSwitch(callback);

    // Sensor Accessory
    new SpanAccessory();
    new Service::AccessoryInformation();
    new Characteristic::Identify();
    new Characteristic::Name("GaggiMate Heating Status");
    this->heatingSensor = new GaggiMateHeatingSensor();

    if (pluginManager != nullptr) {
        pluginManager->on("BOILER_STATUS", [this](Event &e) { this->handleBoilerStatus(e); });
        pluginManager->on("boiler:heating:stable", [this](Event &e) { this->handleHeatingStatus(e); });
    }

    homeSpan.autoPoll(); 
}

void HomekitBridgePlugin::loop() {
    if (!actionRequired.load() || controller == nullptr) return;

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

void HomekitBridgePlugin::clearAction() {
    actionRequired.store(false);
    lastAction.store(HomekitAction::NONE);
}

void HomekitBridgePlugin::handleBoilerStatus(const Event &event) {
    if (!this->powerSwitch || !this->steamSwitch) return;
    this->powerSwitch->setState(!event.getInt("STANDBY"));
    this->steamSwitch->setState(event.getInt("STEAM_MODE"));
}

void HomekitBridgePlugin::handleHeatingStatus(const Event &event) {
    if (this->heatingSensor) {
        //Safety fix: direct transfer, HomeSpan takes care of thread safety internally
        this->heatingSensor->setStability(event.getInt("isStable") == 1);
    }
}