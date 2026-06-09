#ifndef CONTROLLER_H
#define CONTROLLER_H

#include "GaggiMateClient.h"
#include "PluginManager.h"
#include "Settings.h"
#include "SystemInfo.h"
#include <WiFi.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/Process.h>
#ifndef GAGGIMATE_HEADLESS
#include <display/drivers/Driver.h>
#include <display/ui/default/DefaultUI.h>
#endif

const IPAddress WIFI_AP_IP(4, 4, 4, 1); // the IP address the web server, Samsung requires the IP to be in public space
const IPAddress WIFI_SUBNET_MASK(255, 255, 255, 0); // no need to change: https://avinetworks.com/glossary/subnet-mask/

enum class VolumetricMeasurementSource { INACTIVE, FLOW_ESTIMATION, BLUETOOTH };

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
    void setTargetGrindDuration(int duration);
    void setTargetGrindVolume(double volume);

    int getMode() const;

    float getTargetTemp() const;
    int getTargetGrindDuration() const;
    virtual float getCurrentTemp() const { return currentTemp; }
    bool isActive() const;
    bool isGrindActive() const;
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

    bool isTaskHealthy() const { return is_task_healthy(eTaskGetState(taskHandle)); }

    void autotune(int testTime, int samples, int heaterWattage);
    void startProcess(Process *process);
    Process *getProcess() const { return currentProcess; }
    Process *getLastProcess() const { return lastProcess; }
    Settings &getSettings() { return settings; }
    ProfileManager *getProfileManager() { return profileManager; }
#ifndef GAGGIMATE_HEADLESS
    DefaultUI *getUI() const { return ui; }
#endif
    bool isErrorState() const { return error > 0; }
    int getError() const { return error; }

    // Event callback methods
    void updateLastAction();
    void raiseTemp();
    void lowerTemp();
    void raiseBrewTarget();
    void lowerBrewTarget();
    void raiseGrindTarget();
    void lowerGrindTarget();
    void activate();
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
    int getWaterLevel() const {
        float reversedLevel = static_cast<float>(settings.getEmptyTankDistance()) -
                              static_cast<float>(std::min(settings.getEmptyTankDistance(), tofDistance));
        float range = static_cast<float>(settings.getEmptyTankDistance() - settings.getFullTankDistance());
        return static_cast<int>(std::min(reversedLevel / range * 100.0f, 100.0f));
    };
    int getTofDistance() const { return tofDistance; }

    void onVolumetricDelete();
    bool isLowWaterLevel() const { return getWaterLevel() < 20; };

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

    // Event handlers
    void onTempRead(float temperature);

    void handleBrewButton(int brewButtonStatus);
    void handleSteamButton(int steamButtonStatus);
    void handleWaterButton(int buttonStatus);
    void handleProfileButton(int buttonStatus, String id);
    void handleProfileUpdate();

    // Private Attributes
#ifndef GAGGIMATE_HEADLESS
    DefaultUI *ui = nullptr;
    Driver *driver = nullptr;
#endif
    GaggiMateClient comms;
    hw_timer_t *timer = nullptr;
    Settings settings;
    PluginManager *pluginManager{};
    ProfileManager *profileManager{};

    int mode = MODE_BREW;
    float currentTemp = 0;
    float pressure = 0.0f;
    float targetPressure = 0.0f;
    float currentPuckFlow = 0.0f;
    float currentPumpFlow = 0.0f;
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
    bool volumetricOverride = false;
    bool processCompleted = false;
    bool steamReady = false;
    bool sdcard = false;
    int error = 0;

    // Bluetooth scale connection monitoring
    VolumetricMeasurementSource currentVolumetricSource = VolumetricMeasurementSource::INACTIVE;
    unsigned long lastBluetoothMeasurement = 0;
    static const unsigned long BLUETOOTH_GRACE_PERIOD_MS = 1500; // 1.5 second grace period
    static const unsigned long CONTROLLER_WAITING_TIMEOUT_MS = 10000;

    xTaskHandle taskHandle;
    xTaskHandle logicTaskHandle;

    static void loopTask(void *arg);
    static void loopLogicTask(void *arg);
};

#endif // CONTROLLER_H
