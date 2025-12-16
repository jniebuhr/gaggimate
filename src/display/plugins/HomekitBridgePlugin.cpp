#include "HomekitBridgePlugin.h"
#include "../core/Controller.h"
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
    contactState = new Characteristic::ContactSensorState(0);
}

void GaggiMateHeatingSensor::setHeatingState(bool isHeating) {
    if (isHeating) {
        // Red (heating up) indicate Open (0)
        contactState->setVal(0, true);
    } else {
        // Green (Ready) report Closed (1)
        contactState->setVal(1, true);
    }
}

// HomekitBridgePlugin (Bridge-logic)

HomekitBridgePlugin::HomekitBridgePlugin(String wifiSsid, String wifiPassword) {
    this->wifiSsid = std::move(wifiSsid);
    this->wifiPassword = std::move(wifiPassword);
}

HomekitAction HomekitBridgePlugin::getAction() const { return lastAction; }
bool HomekitBridgePlugin::getSwitch1State() const { return actionSwitch1State; }
bool HomekitBridgePlugin::getSwitch2State() const { return actionSwitch2State; }

bool HomekitBridgePlugin::hasAction() const { return actionRequired; }

void HomekitBridgePlugin::clearAction() { lastAction = HomekitAction::NONE; actionRequired = false; }

void HomekitBridgePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    // Event handler for status changes
    pluginManager->on("boiler:status:change", [this](const Event &event) {
        this->handleBoilerStatus(event);
    });

    pluginManager->on("boiler:heating:stable", [this](const Event &event) {
        this->handleHeatingStatus(event);
    });

    // Sync GaggiMate to HomeKit (Mode Change)
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        if (powerSwitch == nullptr || steamSwitch == nullptr)
            return;

        int mode = event.getInt("value");

        // Power Switch
        bool active = mode != MODE_STANDBY;
        powerSwitch->setState(active);

        // Steam Switch
        bool isSteamActive = mode == MODE_STEAM;
        steamSwitch->setState(isSteamActive);
    });

    pluginManager->on("controller:wifi:connect", [this](Event &event) {
        int apMode = event.getInt("AP");
        if (apMode)
            return;

        // for stability
        homeSpan.setHostNameSuffix("");
        homeSpan.setPortNum(HOMESPAN_PORT);

        // initialization bridge
        homeSpan.begin(
            Category::Bridges,
            DEVICE_NAME,
            this->controller->getSettings().getMdnsName().c_str()
        );
        homeSpan.setWifiCredentials(wifiSsid.c_str(), wifiPassword.c_str());

        // Central callback: Sets lastAction and the critical actionRequired flag
        auto callback = [this](HomekitAction action, bool state) {
            this->lastAction = action;
            if (action == HomekitAction::SWITCH_1_TOGGLE) {
                this->actionSwitch1State = state;
            } else if (action == HomekitAction::SWITCH_2_TOGGLE) {
                this->actionSwitch2State = state;
            }
            this->actionRequired = true;
        };

        // 2. Accessoire 1: Bridge (Required to create a bridge securely; removal could cause problems)
        new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();

        // 3. Accessoire 2: Power Switch (Boiler)
        new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Power");
        powerSwitch = new GaggiMatePowerSwitch(callback);

        // 4. Accessoire 3: Steam Switch
        new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Steam");
        steamSwitch = new GaggiMateSteamSwitch(callback);

        // 5. Accessoire 4: Heating Status Sensor
        new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Heating Status");
        this->heatingSensor = new GaggiMateHeatingSensor();

        // 6. Accessoire 5: Thermostat (not working, activation leads to compliance issues in Apple Home)
        /*
        new SpanAccessory();
        new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("GaggiMate Thermostat");
        // thermostat = new HomekitThermostat(callback);
        */

        homeSpan.autoPoll();
    });
}

void HomekitBridgePlugin::loop() {
    if (!actionRequired || controller == nullptr)
        return;

    // Actions from Homekit

    if (lastAction == HomekitAction::SWITCH_1_TOGGLE) {
        // Power Switch
        if (actionSwitch1State) {
            controller->deactivateStandby();
        } else {
            controller->activateStandby();
        }
    } else if (lastAction == HomekitAction::SWITCH_2_TOGGLE) {
        // Steam Switch
        if (actionSwitch2State) {
             controller->setMode(MODE_STEAM);
        } else {
             controller->deactivate();
             controller->setMode(MODE_BREW);
        }
    }

    this->clearAction();
}

// Event-Handler

void HomekitBridgePlugin::handleBoilerStatus(const Event &event) {
    if (!this->powerSwitch || !this->steamSwitch) return;

    // Power Switch sync
    bool isStandby = event.getInt("STANDBY");
    this->powerSwitch->setState(!isStandby);

    // Steam Switch sync
    bool isSteamActive = event.getInt("STEAM_MODE");
    this->steamSwitch->setState(isSteamActive);
}


void HomekitBridgePlugin::handleHeatingStatus(const Event &event) {
    if (heatingSensor == nullptr) return;

    int isStable = event.getInt("isStable");

    // isHeating = true when isStable == 0
    heatingSensor->setHeatingState(isStable == 0);
}