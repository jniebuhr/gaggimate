#pragma once
#include "BluetoothDevice.h"
#include "lru_cache.h"
#include <vector>

// Continuous scan that collects every advertiser a registered driver claims, tagged with the driver's device type.
class BluetoothDeviceScanner : public NimBLEAdvertisedDeviceCallbacks {
  private:
    bool isRunning = false;
    LRUCache alreadySeenAddresses = LRUCache(100);
    std::vector<DiscoveredDevice> discoveredDevices;
    void cleanupDiscoveredDevices();
    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;

  public:
    std::vector<DiscoveredDevice> getDiscoveredDevices() { return discoveredDevices; }

    void initializeAsyncScan();
    void stopAsyncScan();
    void restartAsyncScan();
    bool isScanRunning() const;
};
