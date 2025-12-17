#include "HomekitBridgePlugin.h"
#include "../core/Controller.h"
#include "../core/PluginManager.h"
#include "../core/constants.h"
#include <utility>
#include <Arduino.h>

// GaggiMatePowerSwitch
GaggiMatePowerSwitch::GaggiMatePowerSwitch(bridge_callback_t callback) : callback(std::move(callback)), power(nullptr) {
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
    power->setVal(active, true);
}


// GaggiMateSteamSwitch
GaggiMateSteamSwitch::GaggiMateSteamSwitch(bridge_callback_t callback) : callback(std::move(callback)), power(nullptr) {
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
    power->setVal(active, true);
}


// GaggiMateHeatingSensor
GaggiMateHeatingSensor::GaggiMateHeatingSensor() : Service::ContactSensor() {
    // Starting value: 0 = Closed
    contactState = new Characteristic::ContactSensorState(0); 
}

void GaggiMateHeatingSensor::setStability(bool isStable) {
    // 0 = Closed -> Ready
    // 1 = Open -> Heating
    int targetVal = isStable ? 0 : 1;
    
    if (contactState->getVal() != targetVal) {
        contactState->setVal(targetVal, true);
    }
}


// HomekitBridgePlugin Implementation

HomekitBridgePlugin::HomekitBridgePlugin(String wifiSsid, String wifiPassword) 
    : wifiSsid(std::move(wifiSsid)), wifiPassword(std::move(wifiPassword)) {
}

void HomekitBridgePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    // Central callback, fix with Atomic .store)
    auto callback = [this](HomekitAction action, bool state) {
        this->lastAction.store(action); 
        
        if (action == HomekitAction::SWITCH_1_TOGGLE) {
            this->actionSwitch1State.store(state);
        } else if (action == HomekitAction::SWITCH_2_TOGGLE) {
            this->actionSwitch2State.store(state);
        }
        
        this->actionRequired.store(true);
    };

    homeSpan.setWifiCredentials(wifiSsid.c_str(), wifiPassword.c_str());
    homeSpan.setPairingCode("46637726");
    homeSpan.setQRID("GAGG");

    homeSpan.begin(Category::Bridges, DEVICE_NAME, DEVICE_NAME, DEVICE_NAME);

    // Bridge Device
    new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name(DEVICE_NAME " Bridge");
        new Characteristic::Manufacturer("GaggiMate");
        new Characteristic::SerialNumber("GM-1000");
        new Characteristic::Model("Bridge");
        new Characteristic::FirmwareRevision("1.0.0");
        
    // Power Switch
    new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Power");
        this->powerSwitch = new GaggiMatePowerSwitch(callback);

    // Steam Switch
    new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Steam");
        this->steamSwitch = new GaggiMateSteamSwitch(callback);

    // Status Sensor
    new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Status");
        this->heatingSensor = new GaggiMateHeatingSensor();

    // Event Listener
    if (pluginManager != nullptr) {
        
        pluginManager->on("BOILER_STATUS", 
            [this](Event &e) { this->handleBoilerStatus(e); });
            
        pluginManager->on("boiler:heating:stable", 
            [this](Event &e) { this->handleHeatingStatus(e); });
    }
}

void HomekitBridgePlugin::loop() {
    homeSpan.poll(); 

    if (!actionRequired.load() || controller == nullptr)
        return;

    HomekitAction currentAction = lastAction.load();

    if (currentAction == HomekitAction::SWITCH_1_TOGGLE) {
        if (actionSwitch1State.load()) {
            controller->deactivateStandby();
        } else {
            controller->activateStandby();
        }
    } else if (currentAction == HomekitAction::SWITCH_2_TOGGLE) {
        if (actionSwitch2State.load()) {
             controller->setMode(MODE_STEAM);
        } else {
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

// Event-Handler

void HomekitBridgePlugin::handleBoilerStatus(const Event &event) {
    if (!this->powerSwitch || !this->steamSwitch) return;

    bool isStandby = event.getInt("STANDBY");
    this->powerSwitch->setState(!isStandby);

    bool isSteamActive = event.getInt("STEAM_MODE");
    this->steamSwitch->setState(isSteamActive);
}

void HomekitBridgePlugin::handleHeatingStatus(const Event &event) {
    if (this->heatingSensor == nullptr) return;

    // isStable from Event: 1 = stable, 0 = heating
    int isStable = event.getInt("isStable");
    this->heatingSensor->setStability(isStable == 1);
}