#include "BluetoothDeviceScanner.h"
#include "BluetoothDeviceRegistry.h"

void BluetoothDeviceScanner::initializeAsyncScan() {
    if (isRunning)
        return;
    cleanupDiscoveredDevices();

    // wantDuplicates=true keeps NimBLE from storing every advertiser, which exhausts memory over time.
    NimBLEDevice::getScan()->setAdvertisedDeviceCallbacks(this, true);
    NimBLEDevice::getScan()->setInterval(500);
    NimBLEDevice::getScan()->setWindow(100);
    NimBLEDevice::getScan()->setMaxResults(0);
    NimBLEDevice::getScan()->setDuplicateFilter(false);
    NimBLEDevice::getScan()->setActiveScan(true);
    NimBLEDevice::getScan()->start(0, nullptr, false); // Set to 0 for continuous
    isRunning = true;
}

void BluetoothDeviceScanner::stopAsyncScan() {
    if (!isRunning)
        return;
    NimBLEDevice::getScan()->stop();
    NimBLEDevice::getScan()->clearResults();
    alreadySeenAddresses.cleanup();
    isRunning = false;
}

void BluetoothDeviceScanner::restartAsyncScan() {
    stopAsyncScan();
    initializeAsyncScan();
}

void BluetoothDeviceScanner::onResult(NimBLEAdvertisedDevice *advertisedDevice) {
    // Only claimed devices enter the seen-cache: a name that arrives in the scan response must still match later.
    DiscoveredDevice device(advertisedDevice);
    const BluetoothDeviceDriver *driver = BluetoothDeviceRegistry::getInstance()->findDriver(device);
    if (driver == nullptr) {
        return;
    }
    const uint8_t *addrBytes = advertisedDevice->getAddress().getNative();
    std::string addrStr(addrBytes, addrBytes + 6);
    if (!alreadySeenAddresses.exists(addrStr)) {
        device.setType(driver->type);
        discoveredDevices.push_back(device);
    }
}

void BluetoothDeviceScanner::cleanupDiscoveredDevices() { discoveredDevices.clear(); }

bool BluetoothDeviceScanner::isScanRunning() const { return isRunning; }
