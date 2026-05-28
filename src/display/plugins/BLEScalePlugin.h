#ifndef BLESCALEPLUGIN_H
#define BLESCALEPLUGIN_H
#include "../core/Plugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"

void on_ble_measurement(float value);

constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
constexpr unsigned int RECONNECTION_TRIES = 15;
// Cap on how many consecutive update() ticks (at UPDATE_INTERVAL_MS each)
// the saved-scale auto-reconnect path will run without seeing the saved
// scale in the discovered list. After this we stop trying until a manual
// scan / mode change / reboot resets the counter. Without this cap the
// loop runs every 1 s indefinitely when the saved scale is powered off,
// hammering the scanner and producing no value.
constexpr unsigned int SAVED_SCALE_RETRY_BUDGET = 60;
// How long the firmware considers an async BLE scan to be "in progress"
// before emitting scale:scan:complete. NimBLE's `initializeAsyncScan` in
// the remote-scales lib doesn't surface a completion callback, so we
// time-box it. ~5 s matches the lib's internal default and is long
// enough for sleeping scales to advertise at least once.
constexpr unsigned long SCAN_DURATION_MS = 5000;

class BLEScalePlugin : public Plugin {
  public:
    BLEScalePlugin();
    ~BLEScalePlugin();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;
    ;

    void connect(const std::string &uuid);
    void scan();
    void disconnect();
    void onMeasurement(float value) const;
    // All scale accessors local-capture the `scale` unique_ptr's raw
    // pointer before testing+dereferencing it. Without this, a check-then-
    // use across `if (scale != nullptr) scale->foo()` is unsafe whenever
    // another task (the bluetooth-disconnect event handler on core 0, or
    // `update()`'s reconnection-tries timeout on core 1) can null `scale`
    // between the check and the call. Mirror of the local-capture pattern
    // already applied to `Controller::onVolumetricMeasurement` for the
    // same family of cross-core UAF.
    bool isConnected() {
        auto *s = scale.get();
        return s != nullptr && s->isConnected();
    };
    std::string getName() {
        auto *s = scale.get();
        if (s != nullptr && s->isConnected()) {
            return s->getDeviceName();
        }
        return "";
    };
    std::string getUUID() {
        auto *s = scale.get();
        if (s != nullptr && s->isConnected()) {
            return s->getDeviceAddress();
        }
        return "";
    };
    int getRSSI() {
        auto *s = scale.get();
        if (s != nullptr && s->isConnected()) {
            return s->getRSSI();
        }
        return 0;
    };

    std::vector<DiscoveredDevice> getDiscoveredScales() const;
    void tare() const;

    // Accessors for the native scale fields that drivers optionally expose
    // (see RemoteScales). Each returns a sentinel value if not supported.
    // Same local-capture pattern as the connectivity accessors above.
    float getFlowRate() const {
        auto *s = scale.get();
        return s != nullptr && s->hasFlowRate() ? s->getFlowRate() : 0.0f;
    }
    bool hasFlowRate() const {
        auto *s = scale.get();
        return s != nullptr && s->hasFlowRate();
    }
    uint8_t getBatteryLevel() const {
        auto *s = scale.get();
        return s != nullptr && s->hasBatteryLevel() ? s->getBatteryLevel() : REMOTE_SCALES_BATTERY_UNKNOWN;
    }
    bool hasBatteryLevel() const {
        auto *s = scale.get();
        return s != nullptr && s->hasBatteryLevel();
    }
    ScaleWeightUnit getWeightUnit() const {
        auto *s = scale.get();
        return s != nullptr && s->hasWeightUnit() ? s->getWeightUnit() : ScaleWeightUnit::UNKNOWN;
    }
    bool hasWeightUnit() const {
        auto *s = scale.get();
        return s != nullptr && s->hasWeightUnit();
    }
    uint32_t getScaleTimerMs() const {
        auto *s = scale.get();
        return s != nullptr && s->hasScaleTimer() ? s->getScaleTimerMs() : 0;
    }
    bool hasScaleTimer() const {
        auto *s = scale.get();
        return s != nullptr && s->hasScaleTimer();
    }

  private:
    void update();
    void onProcessStart() const;
    void pollScaleMetadata();

    void establishConnection();
    void emitConnectError(const String &address, const char *reason);

    bool active = false;
    bool doConnect = false;
    std::string uuid;

    unsigned long lastUpdate = 0;
    unsigned int reconnectionTries = 0;

    // Scan-completion bookkeeping. `scanInProgress` flips true when scan()
    // is called and false when SCAN_DURATION_MS elapses; the loop fires
    // `scale:scan:complete` exactly once at that boundary so the frontend
    // can clear its "Scanning…" spinner instead of guessing.
    bool scanInProgress = false;
    unsigned long scanDeadline = 0;
    // Counts consecutive update() ticks where the saved scale wasn't in
    // the discovered list. See SAVED_SCALE_RETRY_BUDGET above. Reset to 0
    // on a successful saved-scale connect or on any user-initiated scan
    // (giving the user a fresh window to find their scale).
    unsigned int savedScaleRetries = 0;
    // One-shot latch for the "mid-shot scale disconnect, reconnection
    // attempts exhausted" event — so we don't spam it every loop tick
    // while `scale` is non-null but disconnected.
    bool disconnectEventFired = false;

    // Cached scale-metadata values used to avoid firing an event for each
    // unchanged poll tick. Reset when the scale disconnects.
    uint8_t lastBatteryLevel = REMOTE_SCALES_BATTERY_UNKNOWN;
    ScaleWeightUnit lastWeightUnit = ScaleWeightUnit::UNKNOWN;

    // Latch so the mid-brew oz warning + volumetric abort fires once per
    // transition into ounces, not once per sample at ~10 Hz. Reset on
    // disconnect and when the unit returns to grams.
    mutable bool warnedOunceMidBrew = false;

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
