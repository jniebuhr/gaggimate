#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <algorithm>
#include <cctype>
#include <memory>
#include <vector>

// Timemore Dot (single-sensor scale, GATT service FFF0).
class TimemoreDotScales : public RemoteScales {

public:
  explicit TimemoreDotScales(const DiscoveredDevice& device);
  void update() override;
  bool connect() override;
  void disconnect() override;
  bool isConnected() override;
  bool tare() override;
  void shutdown() override;

  bool hasBatteryLevel() const override { return true; }
  bool hasFlowRate() const override { return true; }
  // Theoretically the dot has timer control but there's not really anything to gain from running a timer
  bool hasTimerControl() const override { return false; }
  void startTimer() override;
  void stopTimer() override;
  void resetTimer() override;

private:
  NimBLERemoteService* service = nullptr;
  NimBLERemoteCharacteristic* weightCharacteristic = nullptr;
  NimBLERemoteCharacteristic* commandCharacteristic = nullptr;

  std::vector<uint8_t> rxBuffer;
  bool crcMismatchLogged = false;

  bool openLink();
  bool secureLink();
  bool discoverCharacteristics();
  bool subscribe();
  void configure();

  bool sendCommand(uint8_t type, const uint8_t* payload = nullptr, size_t length = 0);
  void onNotify(const uint8_t* data, size_t length);
  bool consumeFrame();
  void handleFrame(uint8_t frameClass, uint8_t type, const uint8_t* payload, size_t length);
};

class TimemoreDotScalesPlugin {
public:
  static void apply() {
    auto plugin = RemoteScalesPlugin{
      .id = "plugin-timemore-dot",
      .handles = [](const DiscoveredDevice& device) { return TimemoreDotScalesPlugin::handles(device) || matchesBasic3Link(device.getName()); },
      .initialise = [](const DiscoveredDevice& device) -> std::unique_ptr<RemoteScales> { return std::make_unique<TimemoreDotScales>(device); },
    };
    RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
  }

  // Basic 3.0 Link advertises as "Basic3 Link" (confirmed on real hardware,
  // model TES016) and reuses the Dot GATT protocol (FFF0/FFF1/FFF2), per
  // Beanconqueror's TimemoreBasicScale matcher.
  static bool matchesBasic3Link(const std::string& deviceName) {
    std::string lower(deviceName);
    for (char& c : lower) {
      if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
    }
    return contains(lower, "basic3") || contains(lower, "basic 3") ||
           (contains(lower, "timemore") && contains(lower, "basic"));
  }

  // std::string::contains needs C++23; the toolchains GaggiMate builds with are older.
  static bool contains(std::string_view text, const char* needle) {
    return text.find(needle) != std::string::npos;
  }

private:
  // Advertised as "TIMEMORE_Dot..."; some units use the model code "TES017" instead.
  static bool handles(const DiscoveredDevice& device) {
    std::string name = device.getName();
    if (name.rfind("TIMEMORE_Dot", 0) == 0) return true;
    std::transform(name.begin(), name.end(), name.begin(), [](unsigned char c) { return std::tolower(c); });
    return name.find("tes017") != std::string::npos;
  }
};
