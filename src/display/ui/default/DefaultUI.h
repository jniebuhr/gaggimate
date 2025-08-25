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

int16_t calculate_angle(int set_temp, int range, int offset);

class DefaultUI {
  public:
    DefaultUI(Controller *controller, PluginManager *pluginManager);

    // Default work methods
    void init();
    void loop();
    void loopProfiles();

    // Interface methods
    void changeScreen(lv_obj_t **screen, void (*target_init)(void));

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

    int tempHistory[TEMP_HISTORY_LENGTH] = {0};
    int tempHistoryIndex = 0;
    int prevTargetTemp = 0;
    bool isTempHistoryInitialized = false;
    int isTemperatureStable = false;
    unsigned long lastTempLog = 0;

    void updateTempHistory();
    void updateTempStableFlag();
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
    int volumetricMode = false;
    int grindActive = false;
    int active = false;

    bool rerender = false;
    unsigned long lastRender = 0;

    int mode = MODE_STANDBY;
    int currentTemp = 0;
    int targetTemp = 0;
    int targetDuration = 0;
    int targetVolume = 0;
    int grindDuration = 0;
    float grindVolume = 0.0f;
    int pressureAvailable = 0;
    float pressure = 0.0f;
    int pressureScaling = DEFAULT_PRESSURE_SCALING;
    int heatingFlash = 0;

    int currentProfileIdx;
    String currentProfileId = "";
    int profileLoaded = 0;
    Profile currentProfileChoice{};
    std::vector<String> favoritedProfiles;
    int currentThemeMode = 0; // Track current theme mode

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
