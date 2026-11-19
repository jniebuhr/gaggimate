#pragma once
#include "BluetoothDevice.h"
#include <memory>
#include <vector>

// Maps advertised devices to the driver that implements their protocol.
struct BluetoothDeviceDriver {
    using Filter = bool (*)(const DiscoveredDevice &device);
    using Initialiser = std::unique_ptr<BluetoothDevice> (*)(const DiscoveredDevice &device);
    std::string id;
    BluetoothDeviceType type;
    Filter handles;
    Initialiser initialise;
};

class BluetoothDeviceRegistry {
  public:
    static BluetoothDeviceRegistry *getInstance() {
        if (instance == nullptr) {
            instance = new BluetoothDeviceRegistry();
        }
        return instance;
    }

    BluetoothDeviceRegistry(BluetoothDeviceRegistry &other) = delete;
    void operator=(const BluetoothDeviceRegistry &) = delete;

    // Drivers are matched in registration order; a second registration of the same id is ignored.
    void registerDriver(const BluetoothDeviceDriver &driver);

    // Registers device class T, taking the device type from T::TYPE.
    template <typename T> void registerDriver(const char *id, BluetoothDeviceDriver::Filter handles) {
        registerDriver(
            BluetoothDeviceDriver{id, T::TYPE, handles, [](const DiscoveredDevice &device) -> std::unique_ptr<BluetoothDevice> {
                                      return std::make_unique<T>(device);
                                  }});
    }

    const BluetoothDeviceDriver *findDriver(const DiscoveredDevice &device) const;
    bool containsDriverForDevice(const DiscoveredDevice &device) const { return findDriver(device) != nullptr; }
    // Instantiates the matching driver, or nullptr when no driver handles the device.
    std::unique_ptr<BluetoothDevice> create(const DiscoveredDevice &device) const;

  private:
    static BluetoothDeviceRegistry *instance;
    std::vector<BluetoothDeviceDriver> drivers;
    BluetoothDeviceRegistry() {} // Private constructor to enforce singleton
};
