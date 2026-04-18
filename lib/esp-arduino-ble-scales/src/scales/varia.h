#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"

enum class VariaMessageType : uint8_t {
  SYSTEM = 0xFA,
  WEIGHT = 0x01,
  TARE = 0x82,
  BATTERY = 0x85,
  TIMER = 0x87,
  TIMER_START = 0x88,
  TIMER_STOP = 0x89,
  TIMER_RESET = 0x8a,
};

class VariaScales : public RemoteScales {

public:
  VariaScales(const DiscoveredDevice& device);
  void update() override {};
  bool connect() override;
  void disconnect() override;
  bool isConnected() override;
  bool tare() override;

private:
  NimBLERemoteService* service = nullptr;
  NimBLERemoteCharacteristic* weightCharacteristic = nullptr;
  NimBLERemoteCharacteristic* commandCharacteristic = nullptr;

  int batteryPercent = 0;
  int timerSeconds = 0;

  bool fetchServices();
  void subscribeToNotifications();

  void sendMessage(VariaMessageType msgType, const uint8_t* payload, size_t length, bool waitResponse = false);
  void notifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, uint8_t* pData, size_t length, bool isNotify);

  bool validNotifiedMessage(uint8_t* data, size_t length, size_t expectedLength);
};

class VariaScalesPlugin {
public:
  static void apply() {
    RemoteScalesPlugin plugin = RemoteScalesPlugin{
      .id = "plugin-varia",
      .handles = [](const DiscoveredDevice& device) { return VariaScalesPlugin::handles(device); },
      .initialise = [](const DiscoveredDevice& device) -> std::unique_ptr<RemoteScales> { return std::make_unique<VariaScales>(device); },
    };
    RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
  }
private:
  static bool handles(const DiscoveredDevice& device) {
    const std::string& deviceName = device.getName();
    return !deviceName.empty() &&
      (
        deviceName.find("AKU MINI SCALE") == 0 ||
        deviceName.find("VARIA AKU") == 0 ||
        deviceName.find("Varia AKU") == 0 ||
        deviceName.find("AKU SCALE") == 0
      );
  }
};
