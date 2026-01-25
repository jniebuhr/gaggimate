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
    int targetVal = isStable ? 1 : 0; // 0 = Contact Detected (Closed/Ready), 1 = Open
    
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

void HomekitBridgePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    // Load configuration from Settings
    bool enablePower = controller->getSettings().isHkPowerEnabled();
    bool enableSteam = controller->getSettings().isHkSteamEnabled();
    bool enableSensor = controller->getSettings().isHkSensorEnabled();

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

    homeSpan.setHostNameSuffix("");
    homeSpan.setPortNum(HOMESPAN_PORT);

    homeSpan.begin(Category::Bridges, DEVICE_NAME, this->controller->getSettings().getMdnsName().c_str());
    homeSpan.setWifiCredentials(wifiSsid.c_str(), wifiPassword.c_str());

    // ---------------------------------------------------------
    // 1. The Bridge Accessory (ID = 1)
    // ---------------------------------------------------------
    new SpanAccessory(1); // Explicitly set ID 1
    new Service::AccessoryInformation();
    new Characteristic::Identify();

    // ---------------------------------------------------------
    // 2. Power Accessory (ID = 2)
    // ---------------------------------------------------------
    if (enablePower) {
        new SpanAccessory(2); // Explicitly set ID 2
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Power");
        powerSwitch = new GaggiMatePowerSwitch(callback);
    }

    // ---------------------------------------------------------
    // 3. Steam Accessory (ID = 3)
    // ---------------------------------------------------------
    if (enableSteam) {
        new SpanAccessory(3); // Explicitly set ID 3
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Steam");
        steamSwitch = new GaggiMateSteamSwitch(callback);
    }

    // ---------------------------------------------------------
    // 4. Sensor Accessory (ID = 4)
    // ---------------------------------------------------------
    if (enableSensor) {
        new SpanAccessory(4); // Explicitly set ID 4
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Heating Status");
        this->heatingSensor = new GaggiMateHeatingSensor();
    }

    if (pluginManager != nullptr) {
        // Thread-safe: Mode changes (Machine -> HomeKit)
        pluginManager->on("controller:mode:change", [this](Event const &e) {
            this->currentMachineMode.store(e.getInt("value"));
            this->statusUpdateRequired.store(true);
        });

        // Thread-safe: Heating Status (Machine -> HomeKit)
        pluginManager->on("boiler:heating:stable", [this](Event &e) { 
             this->isHeatingStable.store(e.getInt("isStable") == 1);
             this->heatingUpdateRequired.store(true);
        });
    }

    homeSpan.autoPoll(); 
}

void HomekitBridgePlugin::loop() {
    if (controller == nullptr) return;

    // Thread-Safe Sync: Machine -> HomeKit
    
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