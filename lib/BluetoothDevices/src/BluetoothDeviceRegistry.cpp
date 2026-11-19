#include "BluetoothDeviceRegistry.h"

BluetoothDeviceRegistry *BluetoothDeviceRegistry::instance = nullptr;

void BluetoothDeviceRegistry::registerDriver(const BluetoothDeviceDriver &driver) {
    for (const auto &existingDriver : drivers) {
        if (existingDriver.id == driver.id) {
            return;
        }
    }
    drivers.push_back(driver);
}

const BluetoothDeviceDriver *BluetoothDeviceRegistry::findDriver(const DiscoveredDevice &device) const {
    for (const auto &driver : drivers) {
        if (driver.handles(device)) {
            return &driver;
        }
    }
    return nullptr;
}

std::unique_ptr<BluetoothDevice> BluetoothDeviceRegistry::create(const DiscoveredDevice &device) const {
    const BluetoothDeviceDriver *driver = findDriver(device);
    return driver != nullptr ? driver->initialise(device) : nullptr;
}
