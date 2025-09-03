#ifndef CONTROLLER_H
#define CONTROLLER_H

#include "NimBLEClientController.h"
#include "NimBLEComm.h"
#include "PluginManager.h"
#include "Settings.h"
#include <WiFi.h>
#include <display/core/ProfileManager.h>
#include <display/core/process/Process.h>
#ifndef GAGGIMATE_HEADLESS
#include <display/ui/default/DefaultUI.h>
#endif

const IPAddress WIFI_AP_IP(4, 4, 4, 1); // the IP address the web server, Samsung requires the IP to be in public space
const IPAddress WIFI_SUBNET_MASK(255, 255, 255, 0); // no need to change: https://avinetworks.com/glossary/subnet-mask/

enum class VolumetricMeasurementSource { FLOW_ESTIMATION, BLUETOOTH };

class Controller {
  public:
    Controller() = default;

    void setup();
    void connect();
    void loop();
    void loopControl();

    void setMode(int newMode);
    void setTargetTemp(float temperature);
    void setPressureScale();
    void setPumpModelCoeffs();
    void setTargetDuration(int duration);
    void setTargetVolume(int volume);
    void setTargetGrindDuration(int duration);
    void setTargetGrindVolume(double volume);

    int getMode() const;

    float getTargetTemp() const;
    int getTargetDuration() const;
    int getTargetGrindDuration() const;
    virtual float getCurrentTemp() const { return currentTemp; }
    bool isActive() const;
    bool isGrindActive() const;
    bool isUpdating() const;
    bool isAutotuning() const;
    bool isReady() const;
    bool isVolumetricAvailable() const;
    virtual float getTargetPressure() const { return targetPressure; }
    virtual float getTargetFlow() const { return targetFlow; }
    virtual float getCurrentPressure() const { return pressure; }
    virtual float getCurrentPuckFlow() const { return currentPuckFlow; }
    virtual float getCurrentPumpFlow() const { return currentPumpFlow; }

    void autotune(int testTime, int samples);
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
    void onTargetChange(ProcessTarget target);
    void onVolumetricMeasurement(double measurement, VolumetricMeasurementSource source);
    void setVolumetricOverride(bool override) { volumetricOverride = override; }
    bool isBluetoothScaleHealthy() const;
    void onFlush();
    int getWaterLevel() const {
        float reversedLevel = static_cast<float>(settings.getEmptyTankDistance()) -
                              static_cast<float>(std::min(settings.getEmptyTankDistance(), tofDistance));
        return static_cast<int>((reversedLevel - settings.getFullTankDistance()) /
                                static_cast<float>(settings.getEmptyTankDistance() - settings.getFullTankDistance()) * 100.0f);
    };
    bool isLowWaterLevel() const { return getWaterLevel() < 20; };

    SystemInfo getSystemInfo() const { return systemInfo; }

    NimBLEClientController *getClientController() { return &clientController; }

  private:
    // Initialization methods
    void setupPanel();
    void setupBluetooth();
    void setupInfos();
    void setupWifi();

    // Functional methods
    void updateControl();

    // Event handlers
    void onTempRead(float temperature);

    // brew button
    void handleBrewButton(int brewButtonStatus);

    // steam button
    void handleSteamButton(int steamButtonStatus);
    void handleProfileUpdate();

    // Private Attributes
#ifndef GAGGIMATE_HEADLESS
    DefaultUI *ui = nullptr;
#endif
    NimBLEClientController clientController;
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
    bool initialized = false;
    bool screenReady = false;
    bool volumetricOverride = false;
    bool processCompleted = false;
    bool steamReady = false;
    int error = 0;

    // Bluetooth scale connection monitoring
    unsigned long lastBluetoothMeasurement = 0;
    static const unsigned long BLUETOOTH_GRACE_PERIOD_MS = 1500; // 1.5 second grace period

    xTaskHandle taskHandle;

    static void loopTask(void *arg);
};

#endif // CONTROLLER_H
