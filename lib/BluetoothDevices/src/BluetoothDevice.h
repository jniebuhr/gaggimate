#pragma once
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <string>

// Kinds of devices the library drives; one device of each kind can be connected at a time.
enum class BluetoothDeviceType : uint8_t { SCALE = 0, GRINDER = 1 };
constexpr size_t BLUETOOTH_DEVICE_TYPE_COUNT = 2;

// Stable lowercase name ("scale", "grinder") used in events, settings and the web API.
const char *bluetoothDeviceTypeName(BluetoothDeviceType type);
bool bluetoothDeviceTypeFromName(const std::string &name, BluetoothDeviceType &type);

// Sentinel for "the device reports no battery level".
constexpr uint8_t BLUETOOTH_BATTERY_UNKNOWN = 0xFF;

class DiscoveredDevice {
  public:
    DiscoveredDevice(NimBLEAdvertisedDevice *device)
        : name(device->getName()), address(device->getAddress()), manufacturerData(device->getManufacturerData()),
          rssi(device->getRSSI()) {}
    const std::string &getName() const { return name; }
    const NimBLEAddress &getAddress() const { return address; }
    const std::string &getManufacturerData() const { return manufacturerData; }
    int getRSSI() const { return rssi; }
    // Set by the scanner from the driver that claimed the device.
    BluetoothDeviceType getType() const { return type; }
    void setType(BluetoothDeviceType newType) { type = newType; }

  private:
    std::string name;
    NimBLEAddress address;
    std::string manufacturerData;
    int rssi;
    BluetoothDeviceType type = BluetoothDeviceType::SCALE;
};

class BluetoothScale;
class BluetoothGrinder;

// Common interface of every supported device; BluetoothScale and BluetoothGrinder add the type-specific parts.
class BluetoothDevice {
  public:
    using LogCallback = void (*)(std::string);

    virtual ~BluetoothDevice() noexcept;

    BluetoothDeviceType getType() const { return type; }
    // Typed views without RTTI; nullptr when the device is of another type.
    virtual BluetoothScale *asScale() { return nullptr; }
    virtual BluetoothGrinder *asGrinder() { return nullptr; }

    std::string getDeviceName() const { return device.getName(); }
    std::string getDeviceAddress() const { return device.getAddress().toString(); }
    int getRSSI() const { return client != nullptr ? client->getRssi() : 0; }

    virtual bool connect() = 0;
    virtual void disconnect() = 0;
    virtual bool isConnected() = 0;
    virtual void update() = 0;

    // Powers the device off where the driver supports it.
    virtual void shutdown() {}

    // 0-100 %, or BLUETOOTH_BATTERY_UNKNOWN; only meaningful when hasBatteryLevel() is true.
    uint8_t getBatteryLevel() const { return batteryLevel; }
    virtual bool hasBatteryLevel() const { return false; }

    void setLogCallback(LogCallback logCallback) { this->logCallback = logCallback; }

  protected:
    BluetoothDevice(const DiscoveredDevice &device, BluetoothDeviceType type);
    const DiscoveredDevice &getDevice() const { return device; }

    bool clientConnect();
    void clientCleanup();
    bool clientIsConnected();
    NimBLERemoteService *clientGetService(const NimBLEUUID uuid);
    // Negotiated ATT MTU of the current connection, or 0 when disconnected.
    uint16_t clientGetMTU();

    void setBatteryLevel(uint8_t pct) { batteryLevel = pct; }

    void log(std::string msgFormat, ...);
    std::string byteArrayToHexString(const uint8_t *byteArray, size_t length);

  private:
    // Stored instead of virtual so log() stays callable from the destructor.
    BluetoothDeviceType type;
    uint8_t batteryLevel = BLUETOOTH_BATTERY_UNKNOWN;
    NimBLEClient *client = nullptr;
    DiscoveredDevice device;
    LogCallback logCallback = nullptr;
};
