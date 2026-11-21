#ifndef BLUETOOTHDEVICESPLUGIN_H
#define BLUETOOTHDEVICESPLUGIN_H
#include "../core/Plugin.h"
#include <BluetoothDevices.h>
#include <array>
#include <atomic>
#include <memory>
#include <string>
#include <vector>

constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
// Listening window after a scan request before bluetooth:scan:complete; the scan itself is continuous.
constexpr unsigned long SCAN_WINDOW_MS = 5000;
// Restart period of the continuous scan; NimBLE keeps advertisers whose scan response never arrived until the scan ends.
constexpr unsigned long SCAN_REFRESH_MS = 60000;

class Settings;

// Connects up to one Bluetooth device per type (scale, grinder) and bridges them to the controller.
class BluetoothDevicesPlugin : public Plugin {
  public:
    BluetoothDevicesPlugin();
    ~BluetoothDevicesPlugin();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Connects the device with this address; typeHint only applies while the scan has not seen it (yet).
    void connect(const std::string &address, BluetoothDeviceType typeHint = BluetoothDeviceType::SCALE);
    // User-requested scan: runs for the scan window whenever a device slot is free.
    void scan() { requestScan(true); }
    void forget(BluetoothDeviceType type);

    bool isConnected(BluetoothDeviceType type) const {
        const auto &device = slot(type).device;
        return device != nullptr && device->isConnected();
    }
    std::string getName(BluetoothDeviceType type) const { return isConnected(type) ? slot(type).device->getDeviceName() : ""; }
    std::string getAddress(BluetoothDeviceType type) const {
        return isConnected(type) ? slot(type).device->getDeviceAddress() : "";
    }
    int getRSSI(BluetoothDeviceType type) const { return isConnected(type) ? slot(type).device->getRSSI() : 0; }
    bool hasBatteryLevel(BluetoothDeviceType type) const {
        const auto &device = slot(type).device;
        return device != nullptr && device->hasBatteryLevel();
    }
    uint8_t getBatteryLevel(BluetoothDeviceType type) const {
        return hasBatteryLevel(type) ? slot(type).device->getBatteryLevel() : BLUETOOTH_BATTERY_UNKNOWN;
    }

    std::vector<DiscoveredDevice> getDiscoveredDevices() const;

    // Scale
    bool isScaleConnected() const { return isConnected(BluetoothDeviceType::SCALE); }
    void tare() const;
    void onMeasurement(float value);
    float getFlowRate() const { return hasFlowRate() ? scale()->getFlowRate() : 0.0f; }
    bool hasFlowRate() const { return scale() != nullptr && scale()->hasFlowRate(); }
    ScaleWeightUnit getWeightUnit() const { return hasWeightUnit() ? scale()->getWeightUnit() : ScaleWeightUnit::UNKNOWN; }
    bool hasWeightUnit() const { return scale() != nullptr && scale()->hasWeightUnit(); }
    uint32_t getScaleTimerMs() const { return hasScaleTimer() ? scale()->getScaleTimerMs() : 0; }
    bool hasScaleTimer() const { return scale() != nullptr && scale()->hasScaleTimer(); }

    // Grinder
    bool isGrinderConnected() const { return isConnected(BluetoothDeviceType::GRINDER); }
    GrinderState getGrinderState() const { return grinder() != nullptr ? grinder()->getState() : GrinderState::UNKNOWN; }
    GrinderSettings getGrinderSettings() const {
        return grinder() != nullptr ? grinder()->getReportedSettings() : GrinderSettings{};
    }

  private:
    struct DeviceSlot {
        std::unique_ptr<BluetoothDevice> device;
        bool doConnect = false;
        std::string address;
        std::atomic<bool> forgetRequested{false}; // set by forget() from any task, consumed in loop()
        uint8_t lastBatteryLevel = BLUETOOTH_BATTERY_UNKNOWN;
    };

    DeviceSlot &slot(BluetoothDeviceType type) { return slots[static_cast<size_t>(type)]; }
    const DeviceSlot &slot(BluetoothDeviceType type) const { return slots[static_cast<size_t>(type)]; }
    BluetoothScale *scale() const {
        const auto &device = slot(BluetoothDeviceType::SCALE).device;
        return device != nullptr ? device->asScale() : nullptr;
    }
    BluetoothGrinder *grinder() const {
        const auto &device = slot(BluetoothDeviceType::GRINDER).device;
        return device != nullptr ? device->asGrinder() : nullptr;
    }

    String getSavedAddress(BluetoothDeviceType type) const;
    String getSavedName(BluetoothDeviceType type) const;
    void setSavedAddress(BluetoothDeviceType type, const String &address);
    void setSavedName(BluetoothDeviceType type, const String &name);

    void update();
    void onProcessStart() const;
    void pollDeviceMetadata(BluetoothDeviceType type);
    void syncGrinderProfile(bool force);

    void requestScan(bool userRequested);
    bool hasFreeSlot() const;
    bool wantsBackgroundScan() const;
    void maintainScan(unsigned long now);
    bool establishConnection(BluetoothDeviceType type);
    void disconnect(BluetoothDeviceType type);
    void emitScanComplete();
    void emitDeviceEvent(const char *id, BluetoothDeviceType type, const std::string &address, const char *key,
                         const String &value);

    bool active = false;
    bool shutdownPending = false; // set on entering standby, consumed by loop() before disconnecting

    std::array<DeviceSlot, BLUETOOTH_DEVICE_TYPE_COUNT> slots;

    std::atomic<bool> scanRequested{false}; // set by scan() from any task, consumed in loop()
    bool scanWindowOpen = false;
    unsigned long scanDeadline = 0;
    unsigned long scanRunningSince = 0; // 0 = scanner not running

    unsigned long lastUpdate = 0;

    // Rate limiting for scale measurement callbacks
    unsigned long lastMeasurementTime = 0;
    static constexpr unsigned long MIN_MEASUREMENT_INTERVAL_MS = 10; // Max 100 measurements per second

    std::atomic<bool> grinderSyncRequested{false}; // set on profile changes from any task, consumed in loop()
    GrinderSettings lastGrinderSettings;           // last settings handed to the connected grinder

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    std::unique_ptr<BluetoothDeviceScanner> scanner;
};

extern BluetoothDevicesPlugin BLEDevices;

#endif // BLUETOOTHDEVICESPLUGIN_H
