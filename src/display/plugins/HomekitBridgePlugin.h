#pragma once
#ifndef HOMEKITBRIDGEPLUGIN_H
#define HOMEKITBRIDGEPLUGIN_H

#include "../core/Plugin.h"
#include "HomeSpan.h"
#include <functional>
#include <utility>

#include "../core/Event.h"

#define HOMESPAN_PORT 8080
#define DEVICE_NAME "GaggiMate"

enum class HomekitAction {
    NONE,
    SWITCH_1_TOGGLE,
    SWITCH_2_TOGGLE,
};

// Callback-Type def
typedef std::function<void(HomekitAction, bool)> bridge_callback_t;

// Accessoires

// Switch 1: Power
class GaggiMatePowerSwitch : public Service::Switch {
  public:
    GaggiMatePowerSwitch(bridge_callback_t callback);
    boolean update() override;
    void setState(bool active);

  private:
    bridge_callback_t callback;
    SpanCharacteristic *power;
};

// Switch 2: Steam
class GaggiMateSteamSwitch : public Service::Switch {
  public:
    GaggiMateSteamSwitch(bridge_callback_t callback);
    boolean update() override;
    void setState(bool active);

  private:
    bridge_callback_t callback;
    SpanCharacteristic *power;
};


// Contact Sensor
class GaggiMateHeatingSensor : public Service::ContactSensor {
  public:
    GaggiMateHeatingSensor();
    void setHeatingState(bool isHeating);
  private:
    SpanCharacteristic *contactState;
};

// Plugin Manager
class HomekitBridgePlugin : public Plugin {
  public:
    HomekitBridgePlugin(String wifiSsid, String wifiPassword);
    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Methods controlling HomeKit actions
    HomekitAction getAction() const;
    bool getSwitch1State() const;
    bool getSwitch2State() const;
    bool hasAction() const;
    void clearAction();
    const char *getName() const { return "HomekitBridgePlugin"; }

  private:
    String wifiSsid;
    String wifiPassword;

    // Bridged Accessoires
    GaggiMatePowerSwitch *powerSwitch = nullptr;
    GaggiMateSteamSwitch *steamSwitch = nullptr;
    GaggiMateHeatingSensor *heatingSensor = nullptr;

    HomekitAction lastAction = HomekitAction::NONE;
    bool actionSwitch1State = false;
    bool actionSwitch2State = false;

    bool actionRequired = false; 

    Controller *controller = nullptr;

    // Event Handler
    void handleHeatingStatus(const Event &event);
    void handleBoilerStatus(const Event &event);
};

#endif // HOMEKITBRIDGEPLUGIN_H