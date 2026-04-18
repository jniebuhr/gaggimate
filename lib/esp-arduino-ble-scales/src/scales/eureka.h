#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEUtils.h>
#include <NimBLEScan.h>
#include <vector>
#include <memory>

class EurekaScales : public RemoteScales {

public:
  EurekaScales(const DiscoveredDevice& device);
  void update() override;
  bool connect() override;
  void disconnect() override;
  bool isConnected() override;
  bool tare() override;

private:
  bool markedForReconnection = false;

  NimBLERemoteService* service;
  NimBLERemoteCharacteristic* weightCharacteristic;
  NimBLERemoteCharacteristic* commandCharacteristic;

  std::vector<uint8_t> dataBuffer;

  bool performConnectionHandshake();
  void subscribeToNotifications();

  void sendMessage(const uint8_t* payload, size_t length, bool waitResponse = false);
  void sendHeartbeat();
  void sendId();
  void notifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, uint8_t* pData, size_t length, bool isNotify);
  bool decodeAndHandleNotification();
};

class EurekaScalesPlugin {
public:
  static void apply() {
    RemoteScalesPlugin plugin = RemoteScalesPlugin{
      .id = "plugin-eureka",
      .handles = [](const DiscoveredDevice& device) { return EurekaScalesPlugin::handles(device); },
      .initialise = [](const DiscoveredDevice& device) -> std::unique_ptr<RemoteScales> { return std::make_unique<EurekaScales>(device); },
    };
    RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
  }
private:
  static bool handles(const DiscoveredDevice& device) {
    const std::string& deviceName = device.getName();
    if (!deviceName.empty() && (deviceName.find("CFS-9002") == 0 || deviceName.find("LSJ-001") == 0)) {
      return true;
    }
    const std::string& deviceData = device.getManufacturerData();
    char *pHex = NimBLEUtils::buildHexData(nullptr, (uint8_t*) deviceData.c_str(), deviceData.length());
    std::string md(pHex);
    return !md.empty() && deviceName.empty() && (md.find("a6bc") != std::string::npos || md.find("042") == 0);
  }
};
