#ifndef BLESCALEPLUGIN_H
#define BLESCALEPLUGIN_H
#include "../core/Plugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"

void on_ble_measurement(float value);

constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
constexpr unsigned int RECONNECTION_TRIES = 15;

class BLEScalePlugin : public Plugin {
  public:
    BLEScalePlugin();
    ~BLEScalePlugin();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;
    ;

    void connect(const std::string &uuid);
    void scan() const;
    void disconnect();
    void onMeasurement(float value) const;
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
    uint32_t getScaleTimerMs() const {
        return scale != nullptr && scale->hasScaleTimer() ? scale->getScaleTimerMs() : 0;
    }
    bool hasScaleTimer() const { return scale != nullptr && scale->hasScaleTimer(); }

  private:
    void update();
    void onProcessStart() const;
    void pollScaleMetadata();

    void establishConnection();

    bool active = false;
    bool doConnect = false;
    std::string uuid;

    unsigned long lastUpdate = 0;
    unsigned int reconnectionTries = 0;

    // Cached scale-metadata values used to avoid firing an event for each
    // unchanged poll tick. Reset when the scale disconnects.
    uint8_t lastBatteryLevel = REMOTE_SCALES_BATTERY_UNKNOWN;
    ScaleWeightUnit lastWeightUnit = ScaleWeightUnit::UNKNOWN;

    // Rate limiting for callbacks
    mutable unsigned long lastMeasurementTime = 0;
    static constexpr unsigned long MIN_MEASUREMENT_INTERVAL_MS = 10; // Max 100 measurements per second

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;
    RemoteScalesPluginRegistry *pluginRegistry = nullptr;
    RemoteScalesScanner *scanner = nullptr;
    std::unique_ptr<RemoteScales> scale = nullptr;
};

extern BLEScalePlugin BLEScales;

#endif // BLESCALEPLUGIN_H
