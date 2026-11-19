#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <NimBLEDevice.h>

class FelicitaScale : public RemoteScales {
public:
    FelicitaScale(const DiscoveredDevice& device);

    bool tare() override;
    bool isConnected() override;
    bool connect() override;
    void disconnect() override;
    void update() override;

private:
    NimBLERemoteService* service = nullptr;
    NimBLERemoteCharacteristic* dataCharacteristic = nullptr;
    uint32_t lastHeartbeat = 0;
    bool markedForReconnection = false;

    void notifyCallback(NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify);
    bool performConnectionHandshake();
    void toggleUnit();
    void togglePrecision();
    bool verifyConnected(void);
    void parseStatusUpdate(const uint8_t* data, size_t length);
    uint8_t calculateChecksum(const uint8_t* data, size_t length);
    int32_t parseWeight(const uint8_t* data);

    // Constants specific to Felicita Scales
    static const NimBLEUUID DATA_SERVICE_UUID;
    static const NimBLEUUID DATA_CHARACTERISTIC_UUID;
    static constexpr uint8_t CMD_TARE = 0x54;
    static constexpr uint8_t CMD_TOGGLE_UNIT = 0x55;
    static constexpr uint8_t CMD_TOGGLE_PRECISION = 0x44;
};


class FelicitaScalePlugin {
public:
    static void apply() {
        RemoteScalesPlugin plugin;
        plugin.id = "plugin-felicita";
        plugin.handles = &FelicitaScalePlugin::handles;
        plugin.initialise = &FelicitaScalePlugin::initialise;
        RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
    }

private:
    static bool handles(const DiscoveredDevice& device) {
        const std::string& deviceName = device.getName();
        return !deviceName.empty() && (deviceName.find("FELICITA") == 0);
    }

    static std::unique_ptr<RemoteScales> initialise(const DiscoveredDevice& device) {
        return std::make_unique<FelicitaScale>(device);
    }
};
