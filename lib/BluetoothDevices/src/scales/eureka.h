#pragma once
#include "BluetoothDeviceRegistry.h"
#include "BluetoothScale.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEScan.h>
#include <NimBLEUtils.h>
#include <memory>
#include <vector>

class EurekaScales : public BluetoothScale {

  public:
    EurekaScales(const DiscoveredDevice &device);
    void update() override;
    bool connect() override;
    void disconnect() override;
    bool isConnected() override;
    bool tare() override;

  private:
    bool markedForReconnection = false;

    NimBLERemoteService *service;
    NimBLERemoteCharacteristic *weightCharacteristic;
    NimBLERemoteCharacteristic *commandCharacteristic;

    std::vector<uint8_t> dataBuffer;

    bool performConnectionHandshake();
    void subscribeToNotifications();

    void sendMessage(const uint8_t *payload, size_t length, bool waitResponse = false);
    void sendHeartbeat();
    void sendId();
    void notifyCallback(NimBLERemoteCharacteristic *pBLERemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify);
    bool decodeAndHandleNotification();
};

class EurekaScalesPlugin {
  public:
    static void apply() {
        BluetoothDeviceRegistry::getInstance()->registerDriver<EurekaScales>("plugin-eureka", &EurekaScalesPlugin::handles);
    }

  private:
    static bool handles(const DiscoveredDevice &device) {
        const std::string &deviceName = device.getName();
        if (!deviceName.empty() && (deviceName.find("CFS-9002") == 0 || deviceName.find("LSJ-001") == 0)) {
            return true;
        }
        const std::string &deviceData = device.getManufacturerData();
        char *pHex = NimBLEUtils::buildHexData(nullptr, (uint8_t *)deviceData.c_str(), deviceData.length());
        if (pHex == nullptr) {
            return false;
        }
        std::string md(pHex);
        free(pHex); // buildHexData(target=nullptr,...) malloc's and transfers ownership; must free or it leaks per advertisement
        return !md.empty() && deviceName.empty() && (md.find("a6bc") != std::string::npos || md.find("042") == 0);
    }
};
