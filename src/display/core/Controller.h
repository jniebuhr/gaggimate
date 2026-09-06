#ifndef CONTROLLER_H
#define CONTROLLER_H

#include "GaggiMateClient.h"
#include "PluginManager.h"
#include "Settings.h"
#include "SystemInfo.h"
#include <WiFi.h>
#include <display/core/ButtonHandler.h>
#include <display/core/ProfileManager.h>
#include <display/core/WarningManager.h>
#include <display/core/process/Process.h>
#include <mutex>
#include <vector>
#ifndef GAGGIMATE_HEADLESS
#include <display/drivers/Driver.h>
#include <display/ui/default/DefaultUI.h>
#endif

const IPAddress WIFI_AP_IP(4, 4, 4, 1); // the IP address the web server, Samsung requires the IP to be in public space
const IPAddress WIFI_SUBNET_MASK(255, 255, 255, 0); // no need to change: https://avinetworks.com/glossary/subnet-mask/

enum class VolumetricMeasurementSource { INACTIVE, FLOW_ESTIMATION, BLUETOOTH };

// What the display's standby label reports; shared with the web UI so headless users see the same thing.
enum SystemState {
    SYSTEM_STARTING,
    SYSTEM_WAITING_CONTROLLER,
    SYSTEM_READY,
    SYSTEM_UPDATING,
    SYSTEM_AUTOTUNING,
    SYSTEM_PROTOCOL_MISMATCH,
    SYSTEM_ERROR
};
const char *systemStateKey(SystemState state);

class Controller {
  public:
    Controller() = default;

    void setup();
    void connect();
    void loop();
    void loopLogic();
    void loopControl();

    void setMode(int newMode);
    void setTargetTemp(float temperature);
    void setPressureScale();
    void setPumpModelCoeffs();
    void setPidSettings();
    void setTargetGrindDuration(int duration);
    void setTargetGrindVolume(double volume);

    int getMode() const;

    float getTargetTemp() const;
    int getTargetGrindDuration() const;
    virtual float getCurrentTemp() const { return currentTemp; }
    bool isActive() const;
    bool isGrindActive() const;
    bool isBrewActive() const;
    bool isUpdating() const;
    bool isAutotuning() const;
    bool isReady() const;
    bool isVolumetricAvailable() const;
    bool isSDCard() const { return sdcard; }
    virtual float getTargetPressure() const { return targetPressure; }
    virtual float getTargetFlow() const { return targetFlow; }
    virtual float getCurrentPressure() const { return pressure; }
    virtual float getCurrentPuckFlow() const { return currentPuckFlow; }
    virtual float getCurrentPumpFlow() const { return currentPumpFlow; }
    virtual float getCurrentPumpPower() const { return currentPumpPower; }
    virtual float getCurrentHeaterPower() const { return currentHeaterPower; }
    virtual float getCurrentPuckResistance() const { return currentPuckResistance; }
    virtual float getCurrentCoffeeVolume() const { return currentCoffeeVolume; }
    virtual float getCurrentWaterPumped() const { return currentWaterPumped; }

    bool isTaskHealthy() const { return is_task_healthy(eTaskGetState(logicTaskHandle)); }

    void autotune(int testTime, int samples, int heaterWattage);
    void startProcess(Process *process);
    // Dereferencing the returned pointers requires holding getProcessLock() — the
    // logic task and control entry points delete them at any time (GM-147).
    Process *getProcess() const { return currentProcess; }
    Process *getLastProcess() const { return lastProcess; }
    std::recursive_mutex &getProcessLock() const { return processMutex; }
    Settings &getSettings() { return settings; }
    ProfileManager *getProfileManager() { return profileManager; }
#ifndef GAGGIMATE_HEADLESS
    DefaultUI *getUI() const { return ui; }
#endif
    bool isErrorState() const { return error > 0; }
    int getError() const { return error; }
    SystemState getSystemState() const;
    String getSystemStateMessage() const;

    // Event callback methods
    void updateLastAction();
    void raiseTemp();
    void lowerTemp();
    void raiseBrewTarget();
    void lowerBrewTarget();
    void raiseGrindTarget();
    void lowerGrindTarget();
    void activate(bool ignoreWarnings = false);
    void cancelBrewConfirm();
    void deactivate();
    void clear();
    void activateGrind();
    void deactivateGrind();
    void activateStandby();
    void deactivateStandby();
    void onOTAUpdate();
    void onScreenReady();
    void onTargetToggle();
    void onTargetChange(ProcessTarget target);
    void onProfileSave() const;
    void onProfileSaveAsNew();
    void onVolumetricMeasurement(double measurement, VolumetricMeasurementSource source);
    void setVolumetricOverride(bool override) { volumetricOverride = override; }
    bool isBluetoothScaleHealthy() const;
    void onFlush();
    void onFlushRelease(); // ends a hold-to-flush; no-op otherwise
    int getWaterLevel() const {
        float reversedLevel = static_cast<float>(settings.getEmptyTankDistance()) -
                              static_cast<float>(std::min(settings.getEmptyTankDistance(), tofDistance));
        float range = static_cast<float>(settings.getEmptyTankDistance() - settings.getFullTankDistance());
        return static_cast<int>(std::min(reversedLevel / range * 100.0f, 100.0f));
    };
    int getTofDistance() const { return tofDistance; }

    void onVolumetricDelete();
    bool isLowWaterLevel() const { return getWaterLevel() < 20; };
    bool isSteamSwitchOn() const { return steamSwitchOn; }
    bool isFlushPending() const { return flushPending; }
    WarningManager &getWarnings() { return warnings; }
    const WarningManager &getWarnings() const { return warnings; }

    SystemInfo getSystemInfo() const { return systemInfo; }

    GaggiMateClient *getClientController() { return &comms; }

  private:
    // Initialization methods
#ifndef GAGGIMATE_HEADLESS
    void setupPanel();
#endif
    void setupBluetooth();
    void onSystemInfo(const char *hardware, const char *version, uint32_t protocolVersion, bool dimming, bool pressure,
                      bool ledControl, bool tof, std::vector<uint32_t> addons);
    // Connected to a controller too old to speak the framed protocol: drive the
    // same path as a protocol-version mismatch (OTA recovery only). infoJson is
    // the legacy INFO characteristic contents (hardware/version/capabilities).
    void onIncompatibleController(const String &infoJson);
    void setupWifi();

    // Functional methods
    void updateControl();
    // Switch the BLE connection interval based on whether a process is running.
    // force re-applies even if the desired state is unchanged (use on connect).
    void applyConnectionPriority(bool force = false);

    // Process lifecycle (GM-147): the *Locked helpers assume processMutex is held and
    // collect the event ids to fire; the public wrappers dispatch them after unlocking
    // so plugin handlers never run under the lock (avoids lock-order inversions).
    bool isActiveLocked() const { return currentProcess != nullptr && currentProcess->isActive(); }
    void startProcessLocked(Process *process, std::vector<const char *> &events);
    void deactivateLocked(std::vector<const char *> &events);
    void clearLocked(std::vector<const char *> &events);
    void dispatchEvents(const std::vector<const char *> &events);

    // Event handlers
    void onTempRead(float temperature);
    void onPressureRead(float pressure);

    // Physical buttons (GM-200): raw edges -> ButtonHandler -> behavior handlers. `pressed`
    // false only reaches the handlers for latching switches; momentary presses toggle.
    ButtonHandler::Config buttonConfig() const;
    void onButtonEvent(uint8_t index, ButtonHandler::Event event);
    void runButtonBehavior(const String &behavior, bool pressed);
    void handleBrewButton(bool pressed);
    void handleSteamButton(bool pressed);
    void handleWaterButton(bool pressed);
    void handleFlushButton(bool pressed);
    void handleProfileButton(bool pressed, const String &id);
    void handleProfileUpdate();

    // Private Attributes
#ifndef GAGGIMATE_HEADLESS
    DefaultUI *ui = nullptr;
    Driver *driver = nullptr;
#endif
    GaggiMateClient comms;
    ButtonHandler buttons;
    hw_timer_t *timer = nullptr;
    Settings settings;
    PluginManager *pluginManager{};
    ProfileManager *profileManager{};
    WarningManager warnings;

    int mode = MODE_BREW;
    float currentTemp = 0;
    float pressure = 0.0f;
    float targetPressure = 0.0f;
    float currentPuckFlow = 0.0f;
    float currentPumpFlow = 0.0f;
    float currentPumpPower = 0.0f;
    float currentHeaterPower = 0.0f;
    float currentPuckResistance = 0.0f;
    float currentCoffeeVolume = 0.0f;
    float currentWaterPumped = 0.0f;
    float targetFlow = 0.0f;
    int tofDistance = 0;

    SystemInfo systemInfo{};

    // Last control values sent to the controller. updateControl() only
    // transmits components that differ from these (the controller is stateful
    // and delivery is acknowledged). Reset on (re)connect to force a full resend.
    BoilerCommand lastBoiler{};
    PumpCommand lastPump{};
    RelayCommand lastRelay{};
    bool lastAlt = false;
    bool controlStateSent = false;

    // BLE connection-interval priority: tight while a process runs, relaxed when
    // idle (frees radio airtime for Wi-Fi). Tracks the last requested state.
    bool connLowLatency = false;

    // Guards currentProcess/lastProcess lifecycle across tasks (UI, AsyncTCP, BLE
    // callbacks, logic task). Recursive: locked composites call locked primitives.
    mutable std::recursive_mutex processMutex;
    Process *currentProcess = nullptr;
    Process *lastProcess = nullptr;

    unsigned long grindActiveUntil = 0;
    unsigned long lastPing = 0;
    unsigned long lastProgress = 0;
    unsigned long lastAction = 0;
    bool loaded = false;
    bool updating = false;
    bool autotuning = false;
    bool isApConnection = false;
    // WiFi up/down is signalled (flag only) from the Arduino WiFi event task and
    // acted on in loop(): doing server/socket/mDNS start-stop in that small-stack
    // callback corrupted the heap under load. See setupWifi() + loop().
    volatile bool wifiConnectedPending = false;
    volatile bool wifiDisconnectedPending = false;
    bool initialized = false;
    bool screenReady = false;
    bool waitingForController = false;
    unsigned long connectStartTime = 0;
    // Re-send the config burst for a few seconds after a (re)connect (see loop()).
    unsigned long configResendUntil = 0;
    unsigned long lastConfigResend = 0;
    static const unsigned long CONFIG_RESEND_WINDOW_MS = 8000;
    static const unsigned long CONFIG_RESEND_INTERVAL_MS = 1000;
    bool volumetricOverride = false;
    bool processCompleted = false;
    bool steamReady = false;
    bool steamSwitchOn = false;
    bool flushPending = false; // no flush since entering brew mode, waking up, or the last shot
    bool sdcard = false;
    int error = 0;

    // Bluetooth scale connection monitoring
    VolumetricMeasurementSource currentVolumetricSource = VolumetricMeasurementSource::INACTIVE;
    unsigned long lastBluetoothMeasurement = 0;
    static const unsigned long BLUETOOTH_GRACE_PERIOD_MS = 1500; // 1.5 second grace period
    static const unsigned long CONTROLLER_WAITING_TIMEOUT_MS = 10000;

    xTaskHandle logicTaskHandle;

    static void loopLogicTask(void *arg);
};

#endif // CONTROLLER_H
