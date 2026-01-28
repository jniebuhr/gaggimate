#ifndef DEFAULTUI_H
#define DEFAULTUI_H

#include <display/core/PluginManager.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/drivers/Driver.h>
#include <display/models/profile.h>

#include "./lvgl/ui.h"

class Controller;

constexpr int RERENDER_INTERVAL_IDLE = 2500;
constexpr int RERENDER_INTERVAL_ACTIVE = 100;

constexpr int TEMP_HISTORY_INTERVAL = 250;
constexpr int TEMP_HISTORY_LENGTH = 20 * 1000 / TEMP_HISTORY_INTERVAL;

// Adaptive warmup detection: tracks variance over time to detect thermal equilibrium
constexpr int VARIANCE_SAMPLE_COUNT = 4;
constexpr unsigned long VARIANCE_SAMPLE_INTERVAL_MS = 15000;
constexpr float VARIANCE_PLATEAU_RATIO = 0.85f;
constexpr float VARIANCE_MAX_THRESHOLD = 1.0f;
constexpr unsigned long WARMUP_MIN_STABLE_MS = 60000;
constexpr unsigned long WARMUP_MAX_STABLE_MS = 600000;

int16_t calculate_angle(int set_temp, int range, int offset);

enum class BrewScreenState { Brew, Settings };

class DefaultUI {
  public:
    DefaultUI(Controller *controller, Driver *driver, PluginManager *pluginManager);

    // Default work methods
    void init();
    void loop();
    void loopProfiles();

    // Interface methods
    void changeScreen(lv_obj_t **screen, void (*target_init)(void));

    void changeBrewScreenMode(BrewScreenState state);
    void onProfileSwitch();
    void onNextProfile();
    void onPreviousProfile();
    void onProfileSelect();
    void setBrightness(int brightness) {
        if (panelDriver) {
            panelDriver->setBrightness(brightness);
        }
    };

    void markDirty() { rerender = true; }

    void applyTheme();

  private:
    void setupPanel();
    void setupState();
    void setupReactive();

    void handleScreenChange();

    void updateStandbyScreen();
    void updateStatusScreen() const;

    void adjustDials(lv_obj_t *dials);
    void adjustTempTarget(lv_obj_t *dials);
    void adjustTarget(lv_obj_t *obj, double percentage, double start, double range) const;

    float tempHistory[TEMP_HISTORY_LENGTH] = {0};
    int tempHistoryIndex = 0;
    float prevTargetTemp = 0.0f;
    bool isTempHistoryInitialized = false;
    bool isTemperatureStable = false;
    bool isWarmedUp = false;
    unsigned long stableStartTime = 0;
    unsigned long lastTempLog = 0;
    // Adaptive warmup detection state
    float varianceSamples[VARIANCE_SAMPLE_COUNT] = {0};
    int varianceSampleIndex = 0;
    unsigned long lastVarianceSampleTime = 0;
    bool varianceSamplesReady = false;
    int stabilityLogCounter = 0;

    void updateTempHistory();
    void updateTempStableFlag();
    void resetWarmupState();
    void adjustHeatingIndicator(lv_obj_t *contentPanel);

    Driver *panelDriver = nullptr;
    Controller *controller;
    PluginManager *pluginManager;
    ProfileManager *profileManager;

    // Screen state
    String selectedProfileId = "";
    Profile selectedProfile{};
    int updateAvailable = false;
    int updateActive = false;
    int apActive = false;
    int error = false;
    int autotuning = false;
    int volumetricAvailable = false;
    int bluetoothScales = false;
    int volumetricMode = false;
    int grindActive = false;
    int active = false;
    int smartGrindActive = false;
    int grindAvailable = false;

    // Seasonal flags
    int christmasMode = false;

    bool rerender = false;
    unsigned long lastRender = 0;

    int mode = MODE_STANDBY;
    float currentTemp = 0.0f;
    float targetTemp = 0.0f;
    float targetDuration = 0;
    float targetVolume = 0;
    int grindDuration = 0;
    float grindVolume = 0.0f;
    int pressureAvailable = 0;
    float pressure = 0.0f;
    int pressureScaling = DEFAULT_PRESSURE_SCALING;
    int heatingFlash = 0;
    double bluetoothWeight = 0.0;
    BrewScreenState brewScreenState = BrewScreenState::Brew;

    int currentProfileIdx;
    String currentProfileId = "";
    int profileLoaded = 0;
    Profile currentProfileChoice{};
    std::vector<String> favoritedProfiles;
    int currentThemeMode = -1; // Force applyTheme on first loop

    // Screen change
    lv_obj_t **targetScreen = &ui_InitScreen;
    lv_obj_t *currentScreen = ui_InitScreen;
    void (*targetScreenInit)(void) = &ui_InitScreen_screen_init;

    // Standby brightness control
    unsigned long standbyEnterTime = 0;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);
    xTaskHandle profileTaskHandle;
    static void profileLoopTask(void *arg);
};

#endif // DEFAULTUI_H
