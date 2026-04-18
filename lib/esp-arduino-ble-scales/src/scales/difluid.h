#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <NimBLEDevice.h>

class DifluidScales : public RemoteScales
{
public:
    DifluidScales(const DiscoveredDevice &device);

    bool tare() override;
    bool isConnected() override;
    bool connect() override;
    void disconnect() override;
    void update() override;

private:
    NimBLERemoteService *service = nullptr;
    NimBLERemoteCharacteristic *weightCharacteristic = nullptr;
    uint32_t lastHeartbeat = 0;
    bool markedForReconnection = false;

    void notifyCallback(NimBLERemoteCharacteristic *pBLERemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify);
    bool performConnectionHandshake();
    void setUnitToGram();
    void enableAutoNotifications();
    void sendHeartbeat();
    uint8_t calculateChecksum(const uint8_t *data, size_t length);
    int32_t readInt32BE(const uint8_t *data);
};

// Update the DifluidScalesPlugin class
class DifluidScalesPlugin
{
public:
    static void apply()
    {
        RemoteScalesPlugin plugin;
        plugin.id = "plugin-difluid";
        plugin.handles = &DifluidScalesPlugin::handles;
        plugin.initialise = &DifluidScalesPlugin::initialise;
        RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
    }

private:
    // Determines whether this plugin can handle the given device
    static bool handles(const DiscoveredDevice &device)
    {
        const std::string &deviceName = device.getName();
        if (deviceName.empty())
        {
            return false;
        }
        return deviceName.find("Microbalance") == 0 || deviceName.find("Mb") == 0;
    }

    static std::unique_ptr<RemoteScales> initialise(const DiscoveredDevice &device)
    {
        return std::make_unique<DifluidScales>(device);
    }
};
