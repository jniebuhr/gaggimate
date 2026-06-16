// Host shim for the esp-arduino-ble-scales API (remote_scales.h). BLE scales are
// device-only; this just provides the types BLEScalePlugin.h needs to compile.
#pragma once

#include "WString.h"
#include <cstdint>
#include <string>
#include <vector>

constexpr uint8_t REMOTE_SCALES_BATTERY_UNKNOWN = 255;
enum class ScaleWeightUnit { UNKNOWN, GRAMS, OUNCES };

struct ScaleAddress {
    std::string addr;
    String toString() const { return String(addr.c_str()); }
};

class DiscoveredDevice {
  public:
    ScaleAddress getAddress() const { return _addr; }
    std::string getName() const { return _name; }
    int getRSSI() const { return _rssi; }

    ScaleAddress _addr;
    std::string _name;
    int _rssi = 0;
};

class RemoteScales {
  public:
    virtual ~RemoteScales() = default;
    bool isConnected() { return false; }
    std::string getDeviceName() { return ""; }
    std::string getDeviceAddress() { return ""; }
    int getRSSI() { return 0; }
    bool hasFlowRate() { return false; }
    float getFlowRate() { return 0.0f; }
    bool hasBatteryLevel() { return false; }
    uint8_t getBatteryLevel() { return REMOTE_SCALES_BATTERY_UNKNOWN; }
    bool hasWeightUnit() { return false; }
    ScaleWeightUnit getWeightUnit() { return ScaleWeightUnit::UNKNOWN; }
    bool hasScaleTimer() { return false; }
    uint32_t getScaleTimerMs() { return 0; }
};

class RemoteScalesScanner {
  public:
    std::vector<DiscoveredDevice> getDiscoveredScales() { return {}; }
};
