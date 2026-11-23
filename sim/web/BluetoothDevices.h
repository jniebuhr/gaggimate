// Host shim for lib/BluetoothDevices (NimBLE-only): plain data devices that sim/web/bluetooth_devices_stub.cpp fakes.
#pragma once

#include "../../lib/BluetoothDevices/src/GrinderSettings.h"
#include "WString.h"
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

enum class BluetoothDeviceType : uint8_t { SCALE = 0, GRINDER = 1 };
constexpr size_t BLUETOOTH_DEVICE_TYPE_COUNT = 2;
constexpr uint8_t BLUETOOTH_BATTERY_UNKNOWN = 0xFF;
enum class ScaleWeightUnit : uint8_t { UNKNOWN = 0, GRAM = 1, OUNCE = 2 };

inline const char *bluetoothDeviceTypeName(BluetoothDeviceType type) {
    return type == BluetoothDeviceType::GRINDER ? "grinder" : "scale";
}

inline bool bluetoothDeviceTypeFromName(const std::string &name, BluetoothDeviceType &type) {
    if (name == "scale" || name == "grinder") {
        type = name == "grinder" ? BluetoothDeviceType::GRINDER : BluetoothDeviceType::SCALE;
        return true;
    }
    return false;
}

struct DeviceAddress {
    std::string addr;
    String toString() const { return String(addr.c_str()); }
};

class DiscoveredDevice {
  public:
    DeviceAddress getAddress() const { return _addr; }
    std::string getName() const { return _name; }
    int getRSSI() const { return _rssi; }
    BluetoothDeviceType getType() const { return _type; }

    DeviceAddress _addr;
    std::string _name;
    int _rssi = 0;
    BluetoothDeviceType _type = BluetoothDeviceType::SCALE;
};

class BluetoothScale;
class BluetoothGrinder;

class BluetoothDevice {
  public:
    virtual ~BluetoothDevice() = default;
    virtual BluetoothScale *asScale() { return nullptr; }
    virtual BluetoothGrinder *asGrinder() { return nullptr; }
    bool isConnected() { return true; }
    std::string getDeviceName() const { return name; }
    std::string getDeviceAddress() const { return address; }
    int getRSSI() const { return rssi; }
    bool hasBatteryLevel() const { return battery != BLUETOOTH_BATTERY_UNKNOWN; }
    uint8_t getBatteryLevel() const { return battery; }

    std::string name;
    std::string address;
    int rssi = 0;
    uint8_t battery = BLUETOOTH_BATTERY_UNKNOWN;
};

class BluetoothScale : public BluetoothDevice {
  public:
    BluetoothScale *asScale() override { return this; }
    bool hasFlowRate() const { return false; }
    float getFlowRate() const { return 0.0f; }
    bool hasWeightUnit() const { return false; }
    ScaleWeightUnit getWeightUnit() const { return ScaleWeightUnit::UNKNOWN; }
    bool hasScaleTimer() const { return false; }
    uint32_t getScaleTimerMs() const { return 0; }
};

class BluetoothGrinder : public BluetoothDevice {
  public:
    BluetoothGrinder *asGrinder() override { return this; }
    const GrinderSettings &getReportedSettings() const { return reported; }
    GrinderState getState() const { return GrinderState::IDLE; }

    GrinderSettings reported;
};

class BluetoothDeviceScanner {};
