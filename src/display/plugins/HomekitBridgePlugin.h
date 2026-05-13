#pragma once
#ifndef HOMEKITBRIDGEPLUGIN_H
#define HOMEKITBRIDGEPLUGIN_H

#include "../core/Plugin.h"
#include "HomeSpan.h"
#include <functional>
#include <memory>
#include <utility>
#include <atomic>

#include "../core/Event.h"

static constexpr uint16_t HOMEKIT_BRIDGE_HOMESPAN_PORT = 8080;
static constexpr const char *HOMEKIT_BRIDGE_DEVICE_NAME = "GaggiMate";

enum class HomekitAction {
    NONE,
    SWITCH_1_TOGGLE,
    SWITCH_2_TOGGLE,
};

// Callback type
using bridge_callback_t = std::function<void(HomekitAction, bool)>;

// Accessories

// Switch 1: Power
class GaggiMatePowerSwitch : public Service::Switch {
  public:
    explicit GaggiMatePowerSwitch(bridge_callback_t callback);
    boolean update() override;
    void setState(bool active);

  private:
    bridge_callback_t callback;
    SpanCharacteristic *power;
};

// Switch 2: Steam
class GaggiMateSteamSwitch : public Service::Switch {
  public:
    explicit GaggiMateSteamSwitch(bridge_callback_t callback);
    boolean update() override;
    void setState(bool active);

  private:
    bridge_callback_t callback;
    SpanCharacteristic *power;
};


// Contact Sensor (Heating Status)
class GaggiMateHeatingSensor : public Service::ContactSensor {
  public:
    GaggiMateHeatingSensor();
    void setStability(bool isStable);
  private:
    SpanCharacteristic *contactState;
};

// Plugin Class

class HomekitBridgePlugin : public Plugin {
  public:
    HomekitBridgePlugin(String wifiSsid, String wifiPassword);
    void setup(Controller *pluginController, PluginManager *pluginManager) override;
    void loop() override;

    // Helper
    void clearAction();

    const char *getName() const { return "HomekitBridgePlugin"; }

  private:
    void startHomekitBridge(bool enablePower, bool enableSteam, bool enableSensor, const bridge_callback_t &callback);
    void createBridgeAccessory();
    void createPowerAccessory(const bridge_callback_t &callback);
    void createSteamAccessory(const bridge_callback_t &callback);
    void createHeatingSensorAccessory();

    Controller *controller = nullptr;
    String wifiSsid;
    String wifiPassword;
    bool homekitStarted = false;

    // Bridged accessories
    std::unique_ptr<GaggiMatePowerSwitch> powerSwitch = nullptr;
    std::unique_ptr<GaggiMateSteamSwitch> steamSwitch = nullptr;
    std::unique_ptr<GaggiMateHeatingSensor> heatingSensor = nullptr;

    // Thread-safe variables

    // HomeKit -> machine
    std::atomic<HomekitAction> lastAction{HomekitAction::NONE};
    std::atomic<bool> actionSwitch1State{false};
    std::atomic<bool> actionSwitch2State{false};
    std::atomic<bool> actionRequired{false};

    // Machine -> HomeKit (mode)
    std::atomic<bool> statusUpdateRequired{false};
    std::atomic<int> currentMachineMode{0}; // 0 = Standby default

    // Machine -> HomeKit (heating)
    std::atomic<bool> heatingUpdateRequired{false};
    std::atomic<bool> isHeatingStable{false};
};

#endif // HOMEKITBRIDGEPLUGIN_H
