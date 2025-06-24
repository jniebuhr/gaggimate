#ifndef DEFAULTUI_H
#define DEFAULTUI_H

#include <display/core/PluginManager.h>
#include <display/core/ProfileManager.h>
#include <display/core/constants.h>
#include <display/models/profile.h>
#include <display/drivers/Driver.h>

#include "./lvgl/ui.h"

class Controller;

constexpr int RERENDER_INTERVAL_IDLE = 2500;
constexpr int RERENDER_INTERVAL_ACTIVE = 250;

int16_t calculate_angle(int set_temp, int range, int offset);

class DefaultUI {
  public:
    DefaultUI(Controller *controller, PluginManager *pluginManager);

    // Default work methods
    void init();
    void loop();

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

  private:
    void setupPanel();
    void setupState();
    void setupReactive();

    void handleScreenChange();

    void updateStandbyScreen();
    void updateStatusScreen() const;

    void adjustDials(lv_obj_t *dials);

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

    int currentProfileIdx;
    String currentProfileId;
    Profile currentProfileChoice{};
    std::vector<String> favoritedProfiles;

    // Screen change
    lv_obj_t **targetScreen = &ui_InitScreen;
    lv_obj_t *currentScreen = ui_InitScreen;
    void (*targetScreenInit)(void) = &ui_InitScreen_screen_init;

    // Standby brightness control
    unsigned long standbyEnterTime = 0;

    xTaskHandle taskHandle;
    static void loopTask(void *arg);
};

#endif // DEFAULTUI_H
