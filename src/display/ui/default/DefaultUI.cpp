#include "DefaultUI.h"

#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/drivers/LilyGo-T-RGB/LV_Helper.h>

DefaultUI::DefaultUI(Controller *controller, PluginManager *pluginManager) : controller(controller), pluginManager(pluginManager) {
}

void DefaultUI::init() {
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        int mode = event.getInt("value");
        switch (mode) {
            case MODE_STANDBY:
                changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
                break;
            case MODE_BREW:
                changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init);
                break;
            case MODE_GRIND:
                changeScreen(&ui_GrindScreen, &ui_GrindScreen_screen_init);
                break;
            case MODE_STEAM:
                changeScreen(&ui_SteamScreen, &ui_SteamScreen_screen_init);
                break;
            case MODE_WATER:
                changeScreen(&ui_WaterScreen, &ui_WaterScreen_screen_init);
                break;
            default:
                break;
        };
    });
    pluginManager->on("controller:brew:start", [this](Event const &event) {
        changeScreen(&ui_StatusScreen, &ui_StatusScreen_screen_init);
    });
    pluginManager->on("controller:brew:end", [this](Event const &event) {
        changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init);
    });
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        bluetoothActive = true;
        if (lv_scr_act() == ui_InitScreen) {
            Settings &settings = controller->getSettings();
            settings.getStartupMode() == MODE_BREW
                ? changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init)
                : changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
        }
    });
    pluginManager->on("controller:bluetooth:disconnect", [this](Event const &) {
        bluetoothActive = false;
    });
    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        apActive = event.getInt("AP");
    });
    pluginManager->on("ota:update:start", [this](Event const &) {
        updateActive = true;
        changeScreen(&ui_InitScreen, &ui_InitScreen_screen_init);
    });
    pluginManager->on("ota:update:status", [this](Event const &event) {
        updateAvailable = event.getInt("value");
    });

    setupPanel();
}

void DefaultUI::loop() {
    handleScreenChange();
    if (lv_scr_act() == ui_StandbyScreen) {
        updateStandbyScreen();
    } else {
        updateTemperatures();
        updateDurations();
        updateActiveStates();
    }
    if (lv_scr_act() == ui_StatusScreen) {
        updateStatusScreen();
    }

    lv_timer_handler();
}

void DefaultUI::changeScreen(lv_obj_t **screen, void (*target_init)()) {
    targetScreen = screen;
    targetScreenInit = target_init;
}

void DefaultUI::setupPanel() {
    // Initialize T-RGB, if the initialization fails, false will be returned.
    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            Serial.println("Error, failed to initialize T-RGB");
            delay(1000);
        }
        ESP.restart();
    }
    beginLvglHelper(panel);
    panel.setBrightness(16);
    ui_init();
}

void DefaultUI::handleScreenChange() {
    lv_obj_t *current = lv_scr_act();
    if (current != *targetScreen) {
        _ui_screen_change(targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0, targetScreenInit);
    }
}

void DefaultUI::updateStandbyScreen() const {
    if (!apActive && WiFi.status() == WL_CONNECTED) {
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
            char time[6];
            strftime(time, 6, "%H:%M", &timeinfo);
            lv_label_set_text(ui_StandbyScreen_time, time);
            lv_obj_clear_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
        }
    } else {
        lv_obj_add_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
    }
    bluetoothActive
        ? lv_obj_clear_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN)
        : lv_obj_add_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN);
    !apActive && WiFi.status() == WL_CONNECTED
        ? lv_obj_clear_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN)
        : lv_obj_add_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN);
    updateAvailable
        ? lv_obj_clear_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN)
        : lv_obj_add_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN);
}

void DefaultUI::updateStatusScreen() {
    Settings &settings = controller->getSettings();
    int targetDuration = settings.getTargetDuration();
    unsigned long now = millis();
    unsigned long activeUntil = controller->getActiveUntil();
    unsigned long progress = now - (activeUntil - targetDuration);
    double secondsDouble = targetDuration / 1000.0;
    auto minutes = (int) (secondsDouble / 60.0 - 0.5);
    auto seconds = (int) secondsDouble % 60;
    double progressSecondsDouble = progress / 1000.0;
    auto progressMinutes = (int) (progressSecondsDouble / 60.0 - 0.5);
    auto progressSeconds = (int) progressSecondsDouble % 60;
    lv_bar_set_range(ui_StatusScreen_progressBar, 0, (int) secondsDouble);
    lv_bar_set_value(ui_StatusScreen_progressBar, progress / 1000, LV_ANIM_OFF);
    lv_label_set_text_fmt(ui_StatusScreen_progressLabel, "%2d:%02d / %2d:%02d", progressMinutes, progressSeconds, minutes,
                          seconds);
}

void DefaultUI::updateTemperatures() const {
    int currentTemperature = controller->getCurrentTemp();
    lv_arc_set_value(ui_BrewScreen_tempGauge, currentTemperature);
    lv_arc_set_value(ui_StatusScreen_tempGauge, currentTemperature);
    lv_arc_set_value(ui_MenuScreen_tempGauge, currentTemperature);
    lv_arc_set_value(ui_SteamScreen_tempGauge, currentTemperature);
    lv_arc_set_value(ui_WaterScreen_tempGauge, currentTemperature);
    lv_arc_set_value(ui_GrindScreen_tempGauge, currentTemperature);

    lv_label_set_text_fmt(ui_BrewScreen_tempText, "%d°C", currentTemperature);
    lv_label_set_text_fmt(ui_StatusScreen_tempText, "%d°C", currentTemperature);
    lv_label_set_text_fmt(ui_MenuScreen_tempText, "%d°C", currentTemperature);
    lv_label_set_text_fmt(ui_SteamScreen_tempText, "%d°C", currentTemperature);
    lv_label_set_text_fmt(ui_WaterScreen_tempText, "%d°C", currentTemperature);
    lv_label_set_text_fmt(ui_GrindScreen_tempText, "%d°C", currentTemperature);

    int16_t setTemp = controller->getTargetTemp();
    const int16_t angleRange = 3160;
    double percentage = ((double) setTemp) / ((double) MAX_TEMP);
    int16_t angle = (percentage * ((double) angleRange)) - angleRange / 2;
    lv_img_set_angle(ui_BrewScreen_tempTarget, angle);
    lv_img_set_angle(ui_StatusScreen_tempTarget, angle);
    lv_img_set_angle(ui_MenuScreen_tempTarget, angle);
    lv_img_set_angle(ui_SteamScreen_tempTarget, angle);
    lv_img_set_angle(ui_WaterScreen_tempTarget, angle);
    lv_img_set_angle(ui_GrindScreen_tempTarget, angle);

    lv_label_set_text_fmt(ui_StatusScreen_targetTemp, "%d°C", setTemp);
    lv_label_set_text_fmt(ui_BrewScreen_targetTemp, "%d°C", setTemp);
    lv_label_set_text_fmt(ui_SteamScreen_targetTemp, "%d°C", setTemp);
    lv_label_set_text_fmt(ui_WaterScreen_targetTemp, "%d°C", setTemp);
}

void DefaultUI::updateDurations() {
    Settings &settings = controller->getSettings();

    double secondsDouble = settings.getTargetDuration() / 1000.0;
    auto minutes = (int) (secondsDouble / 60.0 - 0.5);
    auto seconds = (int) secondsDouble % 60;
    lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%2d:%02d", minutes, seconds);
    lv_label_set_text_fmt(ui_StatusScreen_targetDuration, "%2d:%02d", minutes, seconds);

    secondsDouble = settings.getTargetGrindDuration() / 1000.0;
    minutes = (int) (secondsDouble / 60.0 - 0.5);
    seconds = (int) secondsDouble % 60;
    lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%2d:%02d", minutes, seconds);
}

void DefaultUI::updateActiveStates() {
    bool active = controller->isActive();
    lv_imgbtn_set_src(ui_SteamScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr, active ? &ui_img_1456692430 : &ui_img_445946954,
                      nullptr);
    lv_imgbtn_set_src(ui_WaterScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr, active ? &ui_img_1456692430 : &ui_img_445946954,
                      nullptr);
    lv_imgbtn_set_src(ui_GrindScreen_startButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                      controller->isGrindActive() ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
}