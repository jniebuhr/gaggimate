#ifndef DEFAULTUI_H
#define DEFAULTUI_H

#include <display/core/PluginManager.h>
#include <display/core/constants.h>

#include "./lvgl/ui.h"

class Controller;

constexpr int RERENDER_INTERVAL_IDLE = 2500;
constexpr int RERENDER_INTERVAL_ACTIVE = 250;

int16_t calculate_angle(int set_temp);

class DefaultUI {
  public:
    DefaultUI(Controller *controller, PluginManager *pluginManager);

    // Default work methods
    void init();
    void loop();

    // Interface methods
    void changeScreen(lv_obj_t **screen, void (*target_init)(void));

  private:
    void setupPanel() const;

    void handleScreenChange() const;

    void updateStandbyScreen() const;
    void updateMenuScreen() const;
    void updateStatusScreen() const;
    void updateBrewScreen() const;
    void updateGrindScreen() const;
    void updateWaterScreen() const;
    void updateSteamScreen() const;

    Controller *controller;
    PluginManager *pluginManager;

    // Screen state
    bool updateAvailable = false;
    bool updateActive = false;
    bool bluetoothActive = false;
    bool apActive = false;

    bool rerender = false;
    unsigned long lastRender = 0;

    int mode = MODE_STANDBY;

    // Screen change
    lv_obj_t **targetScreen = &ui_InitScreen;
    void (*targetScreenInit)(void) = &ui_InitScreen_screen_init;
};

#endif // DEFAULTUI_H
