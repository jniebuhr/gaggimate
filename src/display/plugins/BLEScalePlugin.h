#ifndef BLESCALEPLUGIN_H
#define BLESCALEPLUGIN_H
#include "../core/Plugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"

void on_ble_measurement(float value);

constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
constexpr unsigned int RECONNECTION_TRIES = 15;

// Async tare verification state
enum class TareState { IDLE, WAITING_FOR_STABLE };

class BLEScalePlugin : public Plugin {
  public:
    BLEScalePlugin();
    ~BLEScalePlugin();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

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

    std::vector<DiscoveredDevice> getDiscoveredScales() const;
    void tare();

  private:
    void update();
    void onProcessStart();
    void checkTareProgress();

    void establishConnection();

    bool active = false;
    bool doConnect = false;
    std::string uuid;

    unsigned long lastUpdate = 0;
    unsigned int reconnectionTries = 0;

    // Rate limiting for callbacks
    mutable unsigned long lastMeasurementTime = 0;
    static constexpr unsigned long MIN_MEASUREMENT_INTERVAL_MS = 10; // Max 100 measurements per second

    // Async tare verification state
    TareState tareState = TareState::IDLE;
    unsigned long tareStartTime = 0;
    int tareAttempt = 0;
    static constexpr int TARE_MAX_RETRIES = 3;
    static constexpr unsigned long TARE_SETTLE_WINDOW_MS = 500;
    static constexpr float TARE_TOLERANCE = 0.5f;

    // Track weight from BLE callbacks (same values sent to BrewProcess)
    mutable float lastCallbackWeight = 0.0f;

    Controller *controller = nullptr;
    RemoteScalesPluginRegistry *pluginRegistry = nullptr;
    RemoteScalesScanner *scanner = nullptr;
    std::unique_ptr<RemoteScales> scale = nullptr;
};

extern BLEScalePlugin BLEScales;

#endif // BLESCALEPLUGIN_H
