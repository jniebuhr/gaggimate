#pragma once
#include "BluetoothDeviceRegistry.h"
#include "BluetoothScale.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <memory>
#include <vector>

enum class EclairMessageType : uint8_t {
    WEIGHT = 0x57,
    FLOW_RATE = 0x46,
    TARE_COMMAND = 0x54,
    BATTERY_STATUS = 0x42,
    TIMER_STATUS = 0x43,
    START_TIMER = 0x53,
    STOP_TIMER = 0x45
};

class EclairScales : public BluetoothScale {
  public:
    EclairScales(const DiscoveredDevice &device);

    bool connect() override;
    void disconnect() override;
    bool isConnected() override;
    void update() override;
    bool tare() override;
    // Only reported once the scale has actually sent a flow ('F') frame.
    bool hasFlowRate() const override { return flowSeen; }

  private:
    NimBLERemoteService *service = nullptr;
    NimBLERemoteCharacteristic *dataCharacteristic = nullptr;
    NimBLERemoteCharacteristic *configCharacteristic = nullptr;
    uint8_t battery = 0;
    bool flowSeen = false;
    uint32_t lastHeartbeat = 0;

    bool performConnectionHandshake();
    void sendMessage(EclairMessageType msgType, const uint8_t *data, size_t dataLength, bool waitResponse = false);
    void notifyCallback(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify);
    void handleDataNotification(uint8_t *data, size_t length);
    void handleConfigNotification(uint8_t *data, size_t length);
    uint8_t calculateXOR(const uint8_t *data, size_t length);
    void subscribeToNotifications();
    void sendHeartbeat();
};

class EclairScalesPlugin {
  public:
    static void apply() {
        BluetoothDeviceRegistry::getInstance()->registerDriver<EclairScales>("plugin-eclair", &EclairScalesPlugin::handles);
    }

  private:
    static bool handles(const DiscoveredDevice &device) {
        const std::string &deviceName = device.getName();
        // Serial.printf("Discovered device: %s\n", deviceName.c_str());
        return !deviceName.empty() && (deviceName.find("ECLAIR-") == 0);
    }
};