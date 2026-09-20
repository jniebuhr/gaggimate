#ifndef BLESCALEPLUGIN_H
#define BLESCALEPLUGIN_H
#include "../core/Plugin.h"
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <atomic>
#include <chrono>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <mutex>

void on_ble_measurement(float value);

constexpr unsigned long UPDATE_INTERVAL_MS = 1000;
constexpr unsigned long SCALE_TASK_INTERVAL_MS = 50;
constexpr unsigned long SCALE_LOCK_TIMEOUT_MS = 50;
constexpr unsigned long SCALE_RECONNECT_PAUSE_MS = 15000;

class BLEScalePlugin : public Plugin {
  public:
    BLEScalePlugin();
    ~BLEScalePlugin();

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

    // Requests only: the scale task owns every NimBLE scan/connect call so a blocking connect never stalls the caller (GM-215).
    void connect(const std::string &uuid);
    void scan() const;
    void disconnect();
    void onMeasurement(float value) const;
    bool isConnected() const { return connected; }
    std::string getName() const {
        return withScale(std::string(), [](RemoteScales &s) { return s.isConnected() ? s.getDeviceName() : std::string(); });
    }
    std::string getUUID() const {
        return withScale(std::string(), [](RemoteScales &s) { return s.isConnected() ? s.getDeviceAddress() : std::string(); });
    }
    int getRSSI() const { return cachedRSSI; }

    std::vector<DiscoveredDevice> getDiscoveredScales() const;
    void tare() const;
    uint32_t requestTare() const;
    void cancelTare() const { pendingTare = 0; }
    bool tareCompleted(uint32_t ticket) const { return completedTare.load() == ticket; }
    bool tareSucceeded() const { return successfulTare; }
    unsigned long tareCompletedAt() const { return tareSentAt; }
    void processMeasurements();

    // Cached by the scale task: the main loop and web handlers poll these every pass and must never touch the scale lock.
    bool hasBatteryLevel() const { return cachedHasBattery; }
    uint8_t getBatteryLevel() const { return cachedBattery; }
    bool hasFlowRate() const { return cachedHasFlowRate; }

    // Rarely used native scale fields (see RemoteScales); each returns a sentinel if unsupported or the scale is busy.
    float getFlowRate() const {
        return withScale(0.0f, [](RemoteScales &s) { return s.hasFlowRate() ? s.getFlowRate() : 0.0f; });
    }
    ScaleWeightUnit getWeightUnit() const {
        return withScale(ScaleWeightUnit::UNKNOWN,
                         [](RemoteScales &s) { return s.hasWeightUnit() ? s.getWeightUnit() : ScaleWeightUnit::UNKNOWN; });
    }
    bool hasWeightUnit() const {
        return withScale(false, [](RemoteScales &s) { return s.hasWeightUnit(); });
    }
    uint32_t getScaleTimerMs() const {
        return withScale<uint32_t>(0, [](RemoteScales &s) { return s.hasScaleTimer() ? s.getScaleTimerMs() : 0; });
    }
    bool hasScaleTimer() const {
        return withScale(false, [](RemoteScales &s) { return s.hasScaleTimer(); });
    }

  private:
    using ScaleMutex = std::recursive_timed_mutex;

    // Bounded wait so UI/web/BLE-callback callers never stall behind a driver call running on the scale task.
    std::unique_lock<ScaleMutex> lockScale(unsigned long timeoutMs = SCALE_LOCK_TIMEOUT_MS) const {
        return std::unique_lock<ScaleMutex>(scaleMutex, std::chrono::milliseconds(timeoutMs));
    }
    template <typename T, typename F> T withScale(T fallback, F fn) const {
        auto lock = lockScale();
        return lock && scale != nullptr ? static_cast<T>(fn(*scale)) : fallback;
    }

    static void taskEntry(void *arg);
    void tick();
    void update();
    void pollScaleMetadata();
    void establishConnection();
    void releaseScale();
    void setActive(bool value);

    // BLE notifications only publish a latest-value mailbox; the logic task consumes it.
    mutable std::mutex measurementMutex;
    mutable bool measurementPending = false;
    mutable float measurement = 0;
    mutable unsigned long measurementAt = 0;
    mutable std::atomic<uint32_t> nextTare{0};
    mutable std::atomic<uint32_t> pendingTare{0};
    std::atomic<uint32_t> completedTare{0};
    std::atomic<bool> successfulTare{false};
    std::atomic<unsigned long> tareSentAt{0};
    std::atomic<bool> stopTimerRequested{false};
    std::atomic<float> cachedFlowRate{0};
    std::atomic<int> cachedRSSI{0};
    unsigned long lastRSSIUpdate = 0;
    std::atomic<bool> active{false};
    std::atomic<bool> doConnect{false};
    std::atomic<bool> connected{false};
    std::atomic<bool> connecting{false};
    std::atomic<bool> cachedHasBattery{false};
    std::atomic<bool> cachedHasFlowRate{false};
    std::atomic<uint8_t> cachedBattery{REMOTE_SCALES_BATTERY_UNKNOWN};
    std::atomic<bool> disconnectRequested{false};
    mutable std::atomic<bool> scanRequested{false};
    std::mutex uuidMutex;
    std::string uuid;
    TaskHandle_t taskHandle = nullptr;

    unsigned long lastUpdate = 0;
    // Same 15s grace the old retry counter gave a lost scale; a connect attempt hogs the radio the controller link shares.
    bool reconnectPaused = false;
    unsigned long reconnectPausedAt = 0;

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
    // Written only by the scale task (under scaleMutex); everyone else reads through lockScale()/withScale().
    mutable ScaleMutex scaleMutex;
    std::unique_ptr<RemoteScales> scale = nullptr;
};

extern BLEScalePlugin BLEScales;

#endif // BLESCALEPLUGIN_H
