#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <vector>
#include <memory>

enum class EclairMessageType : uint8_t {
    WEIGHT = 0x57,           
    FLOW_RATE = 0x46,        
    TARE_COMMAND = 0x54,     
    BATTERY_STATUS = 0x42,   
    TIMER_STATUS = 0x43,     
    START_TIMER = 0x53,      
    STOP_TIMER = 0x45        
};

class EclairScales : public RemoteScales {
public:
    EclairScales(const DiscoveredDevice& device);

    bool connect() override;
    void disconnect() override;
    bool isConnected() override;
    void update() override;
    bool tare() override;

private:
    NimBLERemoteService* service = nullptr;
    NimBLERemoteCharacteristic* dataCharacteristic = nullptr;
    NimBLERemoteCharacteristic* configCharacteristic = nullptr;
    uint8_t battery = 0;
    uint32_t lastHeartbeat = 0;

    bool performConnectionHandshake();
    void sendMessage(EclairMessageType msgType, const uint8_t* data, size_t dataLength, bool waitResponse = false);
    void notifyCallback(NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify);
    void handleDataNotification(uint8_t* data, size_t length);
    void handleConfigNotification(uint8_t* data, size_t length);
    uint8_t calculateXOR(const uint8_t* data, size_t length);
    void subscribeToNotifications();
    void sendHeartbeat();
};

class EclairScalesPlugin {
public:
    static void apply() {
        RemoteScalesPlugin plugin = RemoteScalesPlugin{
            .id = "plugin-eclair",
            .handles = [](const DiscoveredDevice& device) { return EclairScalesPlugin::handles(device); },
            .initialise = [](const DiscoveredDevice& device) -> std::unique_ptr<RemoteScales> {
                return std::make_unique<EclairScales>(device);
            },
        };
        RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
    }

private:
    static bool handles(const DiscoveredDevice& device) {
        const std::string& deviceName = device.getName();
        //Serial.printf("Discovered device: %s\n", deviceName.c_str());
        return !deviceName.empty() && (deviceName.find("ECLAIR-") == 0);
    }
};