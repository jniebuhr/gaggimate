#pragma once
#include "BluetoothDeviceRegistry.h"
#include "BluetoothScale.h"
#include <NimBLEDevice.h>

class myscale : public BluetoothScale {
  public:
    myscale(const DiscoveredDevice &device);

    bool tare() override;
    bool isConnected() override;
    bool connect() override;
    void disconnect() override;
    void update() override;

  private:
    NimBLERemoteService *service = nullptr;
    NimBLERemoteCharacteristic *dataCharacteristic = nullptr;
    NimBLERemoteCharacteristic *writeCharacteristic = nullptr;
    uint32_t lastHeartbeat = 0;
    bool markedForReconnection = false;

    void notifyCallback(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify);
    bool performConnectionHandshake();
    void toggleUnit();
    void togglePrecision();
    bool verifyConnected(void);
    void parseStatusUpdate(const uint8_t *data, size_t length);
    uint8_t calculateChecksum(const uint8_t *data, size_t length);
    int32_t parseWeight(const uint8_t *data);

    // Constants specific to myscale Scales
    static const NimBLEUUID DATA_SERVICE_UUID;
    static const NimBLEUUID DATA_CHARACTERISTIC_UUID;
    static const NimBLEUUID WRITE_CHARACTERISTIC_UUID;
};

class myscalePlugin {
  public:
    static void apply() {
        BluetoothDeviceRegistry::getInstance()->registerDriver<myscale>("plugin-myscale", &myscalePlugin::handles);
    }

  private:
    static bool handles(const DiscoveredDevice &device) {
        const std::string &deviceName = device.getName();
        return !deviceName.empty() &&
               (deviceName.find("blackcoffee") == 0 || deviceName.find("my_scale") == 0 || deviceName.find("MY_SCALE") == 0);
    }
};
