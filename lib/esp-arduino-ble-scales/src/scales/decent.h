#pragma once

#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"

class DecentScales : public RemoteScales {

public:
  DecentScales(const DiscoveredDevice& device);
  virtual ~DecentScales(void);

  bool connect(void) override;
  void disconnect(void) override;
  bool isConnected(void) override;
  void update(void) override;
  bool tare(void) override;

private:
  NimBLERemoteService* service;
  NimBLERemoteCharacteristic* readCharacteristic;
  NimBLERemoteCharacteristic* writeCharacteristic;

  bool markedForReconnection = false;

  unsigned long lastHeartbeatMillis = 0;
  void sendHeartbeat();
  void turnOnOLED();
  void turnOffOLED();

  void readCallback(NimBLERemoteCharacteristic* pCharacteristic, uint8_t* pData,
    size_t length, bool isNotify);

  bool performConnectionHandshake(void);
  bool subscribeToNotifications(void);
  void handleWeightNotification(uint8_t* pData, size_t length);
  bool verifyConnected(void);
};

class DecentScalesPlugin {
public:
  static void apply() {
    RemoteScalesPlugin plugin = RemoteScalesPlugin{
        .id = "plugin-decent",
        .handles =
            [](const DiscoveredDevice& device) {
              return DecentScalesPlugin::handles(device);
            },
        .initialise = [](const DiscoveredDevice& device)
            -> std::unique_ptr<RemoteScales> {
          return std::make_unique<DecentScales>(device);
        },
    };
    RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
  }

private:
  static bool handles(const DiscoveredDevice& device) {
    const std::string& deviceName = device.getName();
    return !deviceName.empty() && (deviceName.find("Decent Scale") == 0 || deviceName.find("EspressiScale") == 0);
  }
};
