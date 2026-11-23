#pragma once

#include "BluetoothDeviceRegistry.h"
#include "BluetoothScale.h"

class DecentScales : public BluetoothScale {

  public:
    DecentScales(const DiscoveredDevice &device);
    virtual ~DecentScales(void);

    bool connect(void) override;
    void disconnect(void) override;
    bool isConnected(void) override;
    void update(void) override;
    bool tare(void) override;

  private:
    NimBLERemoteService *service;
    NimBLERemoteCharacteristic *readCharacteristic;
    NimBLERemoteCharacteristic *writeCharacteristic;

    bool markedForReconnection = false;

    unsigned long lastHeartbeatMillis = 0;
    void sendHeartbeat();
    void turnOnOLED();
    void turnOffOLED();

    void readCallback(NimBLERemoteCharacteristic *pCharacteristic, uint8_t *pData, size_t length, bool isNotify);

    bool performConnectionHandshake(void);
    bool subscribeToNotifications(void);
    void handleWeightNotification(uint8_t *pData, size_t length);
    bool verifyConnected(void);
};

class DecentScalesPlugin {
  public:
    static void apply() {
        BluetoothDeviceRegistry::getInstance()->registerDriver<DecentScales>("plugin-decent", &DecentScalesPlugin::handles);
    }

  private:
    static bool handles(const DiscoveredDevice &device) {
        const std::string &deviceName = device.getName();
        return !deviceName.empty() && (deviceName.find("Decent Scale") == 0 || deviceName.find("EspressiScale") == 0);
    }
};
