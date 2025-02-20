#ifndef CONTROLLER_H
#define CONTROLLER_H

#include "NimBLEClientController.h"
#include "PluginManager.h"
#include "Settings.h"
#include <WiFi.h>
#include <display/core/Process.h>
#include <display/ui/default/DefaultUI.h>

class Controller {
  public:
    Controller() = default;

    // Base methods called from sketch
    void setup();

    void connect();

    void loop(); // Called in loop, encapsulating most of the functionality

    // Getters and setters
    int getMode() const;

    void setMode(int newMode);

    int getTargetTemp();

    void setTargetTemp(int temperature);

    int getTargetDuration() const;

    void setTargetDuration(int duration);

    void setTargetVolume(int volume);

    int getTargetGrindDuration() const;

    void setTargetGrindDuration(int duration);

    void setTargetGrindVolume(int volume);

    virtual int getCurrentTemp() const { return currentTemp; }

    bool isActive() const;

    bool isGrindActive() const;

    bool isUpdating() const;

    bool isVolumetricAvailable() const { return volumetricAvailable; }

    void startProcess(Process *process);
    Process *getProcess() const { return currentProcess; }
    Process *getLastProcess() const { return lastProcess; }
    Settings &getSettings() { return settings; }
    DefaultUI *getUI() const { return ui; }

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

    void onVolumetricMeasurement(double measurement) const;

    void setVolumetricAvailable(bool available) { volumetricAvailable = available; }

  private:
    // Initialization methods
    void setupPanel();

    void setupWifi();

    void setupBluetooth();

    // Functional methods
    void updateRelay();

    // Event handlers
    void onTempRead(float temperature);

    // brew button
    void handleBrewButton(int brewButtonStatus);

    // steam button
    void handleSteamButton(int steamButtonStatus);

    // Private Attributes
    DefaultUI *ui = nullptr;
    NimBLEClientController clientController;
    hw_timer_t *timer = nullptr;
    Settings settings;
    PluginManager *pluginManager{};

    int mode = MODE_BREW;
    int currentTemp = 0;

    Process *currentProcess = nullptr;
    Process *lastProcess = nullptr;

    unsigned long grindActiveUntil = 0;
    unsigned long lastPing = 0;
    unsigned long lastProgress = 0;
    unsigned long lastAction = 0;
    bool loaded = false;
    bool updating = false;
    bool isApConnection = false;
    bool initialized = false;
    bool screenReady = false;
    bool volumetricAvailable = false;
};

#endif // CONTROLLER_H
