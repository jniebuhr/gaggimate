#ifndef BLESCALEPLUGIN_H
#define BLESCALEPLUGIN_H
#include "../core/Plugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <atomic>

#include <memory>

void on_ble_measurement(float value);

constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
// Listening window after a scan request before scale:scan:complete; the lib's scan itself is continuous.
constexpr unsigned long SCAN_WINDOW_MS = 5000;

class BLEScalePlugin : public Plugin {
  public:
    BLEScalePlugin();
    ~BLEScalePlugin();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    void connect(const std::string &uuid);
    void scan();
    void forget();
    void disconnect();
    void onMeasurement(float value);
    bool isConnected() { return scale != nullptr && scale->isConnected(); };
    std::string getName() {
        if (scale != nullptr && scale->isConnected()) {
            return scale->getDeviceName();
        }
        return "";
    };
    std::string getUUID() {
        if (scale != nullptr && scale->isConnected()) {
            return scale->getDeviceAddress();
        }
        return "";
    };
    int getRSSI() {
        if (scale != nullptr && scale->isConnected()) {
            return scale->getRSSI();
        }
        return 0;
    };

    std::vector<DiscoveredDevice> getDiscoveredScales() const;
    void tare() const;

    // Accessors for the native scale fields that drivers optionally expose
    // (see RemoteScales). Each returns a sentinel value if not supported.
    float getFlowRate() const { return scale != nullptr && scale->hasFlowRate() ? scale->getFlowRate() : 0.0f; }
    bool hasFlowRate() const { return scale != nullptr && scale->hasFlowRate(); }
    uint8_t getBatteryLevel() const {
        return scale != nullptr && scale->hasBatteryLevel() ? scale->getBatteryLevel() : REMOTE_SCALES_BATTERY_UNKNOWN;
    }
    bool hasBatteryLevel() const { return scale != nullptr && scale->hasBatteryLevel(); }
    ScaleWeightUnit getWeightUnit() const {
        return scale != nullptr && scale->hasWeightUnit() ? scale->getWeightUnit() : ScaleWeightUnit::UNKNOWN;
    }
    bool hasWeightUnit() const { return scale != nullptr && scale->hasWeightUnit(); }
    uint32_t getScaleTimerMs() const { return scale != nullptr && scale->hasScaleTimer() ? scale->getScaleTimerMs() : 0; }
    bool hasScaleTimer() const { return scale != nullptr && scale->hasScaleTimer(); }

  private:
    void update();
    void onProcessStart() const;
    void pollScaleMetadata();

    void establishConnection();
    void emitScanComplete();
    void emitConnectError(const std::string &address, const char *reason);

    bool active = false;
    bool shutdownPending = false; // set on entering standby, consumed by loop() before disconnecting
    bool doConnect = false;
    std::string uuid;

    std::atomic<bool> scanRequested{false};   // set by scan() from any task, consumed in loop()
    std::atomic<bool> forgetRequested{false}; // set by forget() from any task, consumed in loop()
    bool scanWindowOpen = false;
    unsigned long scanDeadline = 0;

    unsigned long lastUpdate = 0;

    // Cached scale-metadata values used to avoid firing an event for each
    // unchanged poll tick. Reset when the scale disconnects.
    uint8_t lastBatteryLevel = REMOTE_SCALES_BATTERY_UNKNOWN;
    ScaleWeightUnit lastWeightUnit = ScaleWeightUnit::UNKNOWN;

    // Rate limiting for callbacks
    unsigned long lastMeasurementTime = 0;
    static constexpr unsigned long MIN_MEASUREMENT_INTERVAL_MS = 10; // Max 100 measurements per second

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    RemoteScalesPluginRegistry *pluginRegistry = nullptr;
    RemoteScalesScanner *scanner = nullptr;
    std::unique_ptr<RemoteScales> scale = nullptr;
};

extern BLEScalePlugin BLEScales;

#endif // BLESCALEPLUGIN_H
