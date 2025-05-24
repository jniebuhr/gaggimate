#include "DefaultUI.h"

#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Process.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#include <display/drivers/common/LV_Helper.h>
#include <display/ui/utils/effects.h>

static EffectManager effect_mgr;

int16_t calculate_angle(int set_temp, int range, int offset) {
    const double percentage = static_cast<double>(set_temp) / static_cast<double>(MAX_TEMP);
    return (percentage * ((double)range)) - range / 2 - offset;
}

DefaultUI::DefaultUI(Controller *controller, PluginManager *pluginManager)
    : controller(controller), pluginManager(pluginManager) {}

void DefaultUI::init() {
    auto triggerRender = [this](Event const &) { rerender = true; };
    pluginManager->on("boiler:currentTemperature:change", [=](Event const &event) {
        currentTemp = event.getFloat("value");
        rerender = true;
    });
    pluginManager->on("boiler:pressure:change", [=](Event const &event) {
        pressure = event.getFloat("value");
        rerender = true;
    });
    pluginManager->on("boiler:targetTemperature:change", [=](Event const &event) {
        targetTemp = event.getInt("value");
        rerender = true;
    });
    pluginManager->on("controller:targetVolume:change", [=](Event const &event) {
        targetVolume = event.getInt("value");
        rerender = true;
    });
    pluginManager->on("controller:targetDuration:change", [=](Event const &event) {
        targetDuration = event.getInt("value");
        rerender = true;
    });
    pluginManager->on("controller:grindDuration:change", [=](Event const &event) {
        grindDuration = event.getInt("value");
        rerender = true;
    });
    pluginManager->on("controller:grindVolume:change", [=](Event const &event) {
        grindVolume = event.getInt("value");
        rerender = true;
    });
    pluginManager->on("controller:grind:end", triggerRender);
    pluginManager->on("controller:grind:start", triggerRender);
    pluginManager->on("controller:brew:start", triggerRender);
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        switch (int mode = event.getInt("value")) {
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
    pluginManager->on("controller:brew:start",
                      [this](Event const &event) { changeScreen(&ui_StatusScreen, &ui_StatusScreen_screen_init); });
    pluginManager->on("controller:brew:clear", [this](Event const &event) {
        if (lv_scr_act() == ui_StatusScreen) {
            changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init);
        }
    });
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        rerender = true;
        if (lv_scr_act() == ui_InitScreen) {
            Settings &settings = controller->getSettings();
            settings.getStartupMode() == MODE_BREW ? changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init)
                                                   : changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
        }
        pressureAvailable = controller->getSystemInfo().capabilities.pressure ? 1 : 0;
    });
    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        rerender = true;
        apActive = event.getInt("AP");
    });
    pluginManager->on("ota:update:start", [this](Event const &) {
        updateActive = true;
        rerender = true;
        changeScreen(&ui_InitScreen, &ui_InitScreen_screen_init);
    });
    pluginManager->on("ota:update:end", [this](Event const &) {
        updateActive = false;
        rerender = true;
        changeScreen(&ui_InitScreen, &ui_InitScreen_screen_init);
    });
    pluginManager->on("ota:update:status", [this](Event const &event) {
        rerender = true;
        updateAvailable = event.getInt("value");
    });
    pluginManager->on("controller:error", [this](Event const &) {
        rerender = true;
        changeScreen(&ui_InitScreen, &ui_InitScreen_screen_init);
    });
    pluginManager->on("controller:autotune:start",
                      [this](Event const &) { changeScreen(&ui_InitScreen, &ui_InitScreen_screen_init); });
    pluginManager->on("controller:autotune:result",
                      [this](Event const &) { changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init); });

    setupPanel();
    setupState();
    setupReactive();
    xTaskCreate(loopTask, "DefaultUI::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle);
}

void DefaultUI::loop() {
    const unsigned long now = millis();
    const unsigned long diff = now - lastRender;
    if ((controller->isActive() && diff > RERENDER_INTERVAL_ACTIVE) || diff > RERENDER_INTERVAL_IDLE) {
        rerender = true;
    }
    if (rerender) {
        rerender = false;
        lastRender = now;
        error = controller->isErrorState();
        autotuning = controller->isAutotuning();
        const Settings &settings = controller->getSettings();
        volumetricAvailable = controller->isVolumetricAvailable();
        volumetricMode = volumetricAvailable && settings.isVolumetricTarget();
        grindActive = controller->isGrindActive();
        active = controller->isActive();
        if (controller->isErrorState()) {
            changeScreen(&ui_InitScreen, &ui_InitScreen_screen_init);
        }
        handleScreenChange();
        currentScreen = lv_scr_act();
        if (lv_scr_act() == ui_StandbyScreen)
            updateStandbyScreen();
        if (lv_scr_act() == ui_StatusScreen)
            updateStatusScreen();
        effect_mgr.evaluate_all();
    }

    lv_task_handler();
}

void DefaultUI::changeScreen(lv_obj_t **screen, void (*target_init)()) {
    targetScreen = screen;
    targetScreenInit = target_init;
    rerender = true;
}

void DefaultUI::setupPanel() const {
    if (LilyGoDriver::getInstance()->isCompatible()) {
        LilyGoDriver::getInstance()->init();
    } else if (WaveshareDriver::getInstance()->isCompatible()) {
        WaveshareDriver::getInstance()->init();
    }
    ui_init();
}

void DefaultUI::setupState() {
    error = controller->isErrorState();
    autotuning = controller->isAutotuning();
    const Settings &settings = controller->getSettings();
    volumetricAvailable = controller->isVolumetricAvailable();
    volumetricMode = volumetricAvailable && settings.isVolumetricTarget();
    grindActive = controller->isGrindActive();
    active = controller->isActive();
    mode = controller->getMode();
    currentTemp = controller->getCurrentTemp();
    targetTemp = controller->getTargetTemp();
    targetDuration = controller->getTargetDuration();
    targetVolume = settings.getTargetVolume();
    grindDuration = settings.getTargetGrindDuration();
    grindVolume = settings.getTargetGrindVolume();
    pressureAvailable = controller->getSystemInfo().capabilities.pressure ? 1 : 0;
}

void DefaultUI::setupReactive() {
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; }, [=]() { adjustDials(ui_MenuScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; }, [=]() { adjustDials(ui_StatusScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; }, [=]() { adjustDials(ui_BrewScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; }, [=]() { adjustDials(ui_GrindScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_WaterScreen; }, [=]() { adjustDials(ui_WaterScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_SteamScreen; }, [=]() { adjustDials(ui_SteamScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
                          [=]() {
                              lv_arc_set_value(uic_MenuScreen_dials_tempGauge, currentTemp);
                              lv_label_set_text_fmt(uic_MenuScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() {
                              lv_arc_set_value(uic_StatusScreen_dials_tempGauge, currentTemp);
                              lv_label_set_text_fmt(uic_StatusScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_arc_set_value(uic_BrewScreen_dials_tempGauge, currentTemp);
                              lv_label_set_text_fmt(uic_BrewScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              lv_arc_set_value(uic_GrindScreen_dials_tempGauge, currentTemp);
                              lv_label_set_text_fmt(uic_GrindScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_WaterScreen; },
                          [=]() {
                              lv_arc_set_value(uic_WaterScreen_dials_tempGauge, currentTemp);
                              lv_label_set_text_fmt(uic_WaterScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_SteamScreen; },
                          [=]() {
                              lv_arc_set_value(uic_SteamScreen_dials_tempGauge, currentTemp);
                              lv_label_set_text_fmt(uic_SteamScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
                          [=]() {
                              int16_t angle =
                                  calculate_angle(targetTemp, pressureAvailable ? 1360 : 3040, pressureAvailable ? 900 : 0);
                              lv_img_set_angle(uic_MenuScreen_dials_tempTarget, angle);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_StatusScreen_targetTemp, "%d°C", targetTemp);
                              int16_t angle =
                                  calculate_angle(targetTemp, pressureAvailable ? 1360 : 3040, pressureAvailable ? 900 : 0);
                              lv_img_set_angle(uic_StatusScreen_dials_tempTarget, angle);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_BrewScreen_targetTemp, "%d°C", targetTemp);
                              int16_t angle =
                                  calculate_angle(targetTemp, pressureAvailable ? 1360 : 3040, pressureAvailable ? 900 : 0);
                              lv_img_set_angle(uic_BrewScreen_dials_tempTarget, angle);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              int16_t angle =
                                  calculate_angle(targetTemp, pressureAvailable ? 1360 : 3040, pressureAvailable ? 900 : 0);
                              lv_img_set_angle(uic_GrindScreen_dials_tempTarget, angle);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_WaterScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_WaterScreen_targetTemp, "%d°C", targetTemp);
                              int16_t angle =
                                  calculate_angle(targetTemp, pressureAvailable ? 1360 : 3040, pressureAvailable ? 900 : 0);
                              lv_img_set_angle(uic_WaterScreen_dials_tempTarget, angle);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_SteamScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_SteamScreen_targetTemp, "%d°C", targetTemp);
                              int16_t angle =
                                  calculate_angle(targetTemp, pressureAvailable ? 1360 : 3040, pressureAvailable ? 900 : 0);
                              lv_img_set_angle(uic_SteamScreen_dials_tempTarget, angle);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
                          [=]() {
                              lv_arc_set_value(uic_MenuScreen_dials_pressureGauge, pressure);
                              lv_label_set_text_fmt(uic_MenuScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() {
                              lv_arc_set_value(uic_StatusScreen_dials_pressureGauge, pressure);
                              lv_label_set_text_fmt(uic_StatusScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_arc_set_value(uic_BrewScreen_dials_pressureGauge, pressure);
                              lv_label_set_text_fmt(uic_BrewScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              lv_arc_set_value(uic_GrindScreen_dials_pressureGauge, pressure);
                              lv_label_set_text_fmt(uic_GrindScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_WaterScreen; },
                          [=]() {
                              lv_arc_set_value(uic_WaterScreen_dials_pressureGauge, pressure);
                              lv_label_set_text_fmt(uic_WaterScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_SteamScreen; },
                          [=]() {
                              lv_arc_set_value(uic_SteamScreen_dials_pressureGauge, pressure);
                              lv_label_set_text_fmt(uic_SteamScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_StandbyScreen; },
                          [=]() {
                              updateAvailable ? lv_obj_clear_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN)
                                              : lv_obj_add_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN);
                          },
                          &updateAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_InitScreen; },
                          [=]() {
                              if (updateActive) {
                                  lv_label_set_text_fmt(ui_InitScreen_mainLabel, "Updating...");
                              } else if (error) {
                                  if (controller->getError() == ERROR_CODE_RUNAWAY) {
                                      lv_label_set_text_fmt(ui_InitScreen_mainLabel, "Temperature error, please restart");
                                  }
                              } else if (autotuning) {
                                  lv_label_set_text_fmt(ui_InitScreen_mainLabel, "Autotuning...");
                              }
                          },
                          &updateAvailable, &error, &autotuning);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              if (volumetricMode) {
                                  lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%dg", targetVolume);
                              } else {
                                  const double secondsDouble = targetDuration / 1000.0;
                                  const auto minutes = static_cast<int>(secondsDouble / 60.0 - 0.5);
                                  const auto seconds = static_cast<int>(secondsDouble) % 60;
                                  lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%2d:%02d", minutes, seconds);
                              }
                          },
                          &targetDuration, &targetVolume, &volumetricMode);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              if (volumetricMode) {
                                  lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%dg", grindVolume);
                              } else {
                                  const double secondsDouble = grindDuration / 1000.0;
                                  const auto minutes = static_cast<int>(secondsDouble / 60.0 - 0.5);
                                  const auto seconds = static_cast<int>(secondsDouble) % 60;
                                  lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%2d:%02d", minutes, seconds);
                              }
                          },
                          &grindDuration, &grindVolume, &volumetricMode);
    effect_mgr.use_effect(
        [=] { return currentScreen == ui_BrewScreen; },
        [=]() {
            lv_img_set_src(ui_BrewScreen_Image4, volumetricMode ? &ui_img_1424216268 : &ui_img_360122106);
            ui_object_set_themeable_style_property(ui_BrewScreen_timedButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_BG_IMG_RECOLOR,
                                                   volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
            ui_object_set_themeable_style_property(ui_BrewScreen_volumetricButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_BG_IMG_RECOLOR,
                                                   volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
            ui_object_set_themeable_style_property(ui_BrewScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                                   volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
            ui_object_set_themeable_style_property(ui_BrewScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_BG_GRAD_COLOR,
                                                   volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
        },
        &volumetricMode);
    effect_mgr.use_effect(
        [=] { return currentScreen == ui_GrindScreen; },
        [=]() {
            lv_img_set_src(ui_GrindScreen_targetSymbol, volumetricMode ? &ui_img_1424216268 : &ui_img_360122106);
            ui_object_set_themeable_style_property(ui_GrindScreen_timedButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_BG_IMG_RECOLOR,
                                                   volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
            ui_object_set_themeable_style_property(ui_GrindScreen_volumetricButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_BG_IMG_RECOLOR,
                                                   volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
            ui_object_set_themeable_style_property(ui_GrindScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                                   volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
            ui_object_set_themeable_style_property(ui_GrindScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_BG_GRAD_COLOR,
                                                   volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
        },
        &volumetricMode);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              if (volumetricAvailable) {
                                  lv_obj_clear_flag(ui_BrewScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
                              } else {
                                  lv_obj_add_flag(ui_BrewScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
                              }
                          },
                          &volumetricAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              if (volumetricAvailable) {
                                  lv_obj_clear_flag(ui_GrindScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
                              } else {
                                  lv_obj_add_flag(ui_GrindScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
                              }
                          },
                          &volumetricAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_WaterScreen; },
                          [=]() {
                              lv_imgbtn_set_src(ui_WaterScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                                                active ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
                          },
                          &active);
    effect_mgr.use_effect([=] { return currentScreen == ui_SteamScreen; },
                          [=]() {
                              lv_imgbtn_set_src(ui_SteamScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                                                active ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
                          },
                          &active);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              lv_imgbtn_set_src(ui_GrindScreen_startButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                                                grindActive ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
                          },
                          &grindActive);
}

void DefaultUI::handleScreenChange() {
    if (lv_obj_t *current = lv_scr_act(); current != *targetScreen) {
        _ui_screen_change(targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0, targetScreenInit);
        _ui_screen_delete(&current);
        rerender = true;
    }
}

void DefaultUI::updateStandbyScreen() const {
    if (!apActive && WiFi.status() == WL_CONNECTED) {
        tm timeinfo;
        if (getLocalTime(&timeinfo, 50)) {
            char time[6];
            strftime(time, 6, "%H:%M", &timeinfo);
            lv_label_set_text(ui_StandbyScreen_time, time);
            lv_obj_clear_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
        }
    } else {
        lv_obj_add_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
    }
    controller->getClientController()->isConnected() ? lv_obj_clear_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN)
                                                     : lv_obj_add_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN);
    !apActive &&WiFi.status() == WL_CONNECTED ? lv_obj_clear_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN)
                                              : lv_obj_add_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN);
}

void DefaultUI::updateStatusScreen() const {
    Process *process = controller->getProcess();
    if (process == nullptr) {
        process = controller->getLastProcess();
    }
    if (process->getType() != MODE_BREW) {
        return;
    }
    const auto *brewProcess = static_cast<BrewProcess *>(process);

    unsigned long now = millis();
    if (!process->isActive()) {
        now = brewProcess->previousPhaseFinished;
    }
    const unsigned long phaseDuration = brewProcess->getPhaseDuration();
    const unsigned long activeUntil = brewProcess->currentPhaseStarted + phaseDuration;
    const unsigned long progress = now - (activeUntil - phaseDuration);
    const double progressSecondsDouble = progress / 1000.0;
    const auto progressMinutes = static_cast<int>(progressSecondsDouble / 60.0 - 0.5);
    const auto progressSeconds = static_cast<int>(progressSecondsDouble) % 60;
    const unsigned long targetDuration = brewProcess->brewTime;
    const double targetSecondsDouble = targetDuration / 1000.0;
    const auto targetMinutes = static_cast<int>(targetSecondsDouble / 60.0 - 0.5);
    const auto targetSeconds = static_cast<int>(targetSecondsDouble) % 60;

    if (brewProcess->infusionBloomTime == 0 || brewProcess->infusionPumpTime == 0) {
        lv_obj_add_flag(ui_StatusScreen_preinfusePumpBar, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(ui_StatusScreen_preinfusePumpLabel, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(ui_StatusScreen_preinfuseBloomBar, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(ui_StatusScreen_preinfuseBloomLabel, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_clear_flag(ui_StatusScreen_preinfusePumpBar, LV_OBJ_FLAG_HIDDEN);
        lv_obj_clear_flag(ui_StatusScreen_preinfusePumpLabel, LV_OBJ_FLAG_HIDDEN);
        lv_obj_clear_flag(ui_StatusScreen_preinfuseBloomBar, LV_OBJ_FLAG_HIDDEN);
        lv_obj_clear_flag(ui_StatusScreen_preinfuseBloomLabel, LV_OBJ_FLAG_HIDDEN);
        lv_bar_set_range(ui_StatusScreen_preinfusePumpBar, 0, brewProcess->infusionPumpTime / 1000);
        lv_label_set_text_fmt(ui_StatusScreen_preinfusePumpLabel, "%ds", brewProcess->infusionPumpTime / 1000);
        lv_bar_set_range(ui_StatusScreen_preinfuseBloomBar, 0, brewProcess->infusionBloomTime / 1000);
        lv_label_set_text_fmt(ui_StatusScreen_preinfuseBloomLabel, "%ds", brewProcess->infusionBloomTime / 1000);
    }

    if (brewProcess->target == ProcessTarget::TIME) {
        lv_bar_set_range(ui_StatusScreen_brewBar, 0, brewProcess->brewTime / 1000);
        lv_label_set_text_fmt(ui_StatusScreen_brewLabel, "%ds", brewProcess->brewTime / 1000);
        lv_label_set_text_fmt(ui_StatusScreen_targetDuration, "%2d:%02d", targetMinutes, targetSeconds);
    } else {
        lv_bar_set_range(ui_StatusScreen_brewBar, 0, brewProcess->brewVolume);
        lv_label_set_text_fmt(ui_StatusScreen_brewLabel, "%dg", brewProcess->brewVolume);
        lv_label_set_text_fmt(ui_StatusScreen_targetDuration, "%dg", brewProcess->brewVolume);
    }

    switch (brewProcess->phase) {
    case BrewPhase::FINISHED:
        lv_label_set_text(ui_StatusScreen_stepLabel, "BREW");
        lv_label_set_text(ui_StatusScreen_phaseLabel, "Finished");
        break;
    case BrewPhase::BREW_PUMP:
        if (brewProcess->target == ProcessTarget::TIME) {
            lv_bar_set_value(ui_StatusScreen_brewBar, progress / 1000, LV_ANIM_OFF);
        } else {
            lv_bar_set_value(ui_StatusScreen_brewBar, brewProcess->currentVolume, LV_ANIM_OFF);
        }
        lv_bar_set_value(ui_StatusScreen_preinfuseBloomBar, brewProcess->infusionBloomTime / 1000, LV_ANIM_OFF);
        lv_bar_set_value(ui_StatusScreen_preinfusePumpBar, brewProcess->infusionPumpTime / 1000, LV_ANIM_OFF);
        lv_label_set_text(ui_StatusScreen_stepLabel, "BREW");
        lv_label_set_text(ui_StatusScreen_phaseLabel, "Flowing...");
        break;
    case BrewPhase::BREW_PRESSURIZE:
        lv_bar_set_value(ui_StatusScreen_preinfuseBloomBar, brewProcess->infusionBloomTime / 1000, LV_ANIM_OFF);
        lv_bar_set_value(ui_StatusScreen_preinfusePumpBar, brewProcess->infusionPumpTime / 1000, LV_ANIM_OFF);
        lv_label_set_text(ui_StatusScreen_stepLabel, "BREW");
        lv_label_set_text(ui_StatusScreen_phaseLabel, "Pressurizing...");
        break;
    case BrewPhase::INFUSION_BLOOM:
        lv_bar_set_value(ui_StatusScreen_preinfuseBloomBar, progress / 1000, LV_ANIM_OFF);
        lv_bar_set_value(ui_StatusScreen_preinfusePumpBar, brewProcess->infusionPumpTime / 1000, LV_ANIM_OFF);
        lv_label_set_text(ui_StatusScreen_stepLabel, "INFUSION");
        lv_label_set_text(ui_StatusScreen_phaseLabel, "Blooming...");
        break;
    case BrewPhase::INFUSION_PUMP:
        lv_bar_set_value(ui_StatusScreen_preinfusePumpBar, progress / 1000, LV_ANIM_OFF);
        lv_label_set_text(ui_StatusScreen_stepLabel, "INFUSION");
        lv_label_set_text(ui_StatusScreen_phaseLabel, "Flowing...");
        break;
    case BrewPhase::INFUSION_PRESSURIZE:
        lv_label_set_text(ui_StatusScreen_stepLabel, "INFUSION");
        lv_label_set_text(ui_StatusScreen_phaseLabel, "Pressurizing...");
        break;
    default:;
    }

    lv_img_set_src(ui_StatusScreen_Image8, brewProcess->target == ProcessTarget::TIME ? &ui_img_360122106 : &ui_img_1424216268);
    lv_label_set_text_fmt(ui_StatusScreen_currentDuration, "%2d:%02d", progressMinutes, progressSeconds);

    // Brew finished adjustments
    if (process->isActive()) {
        lv_obj_add_flag(ui_StatusScreen_brewVolume, LV_OBJ_FLAG_HIDDEN);
    } else {
        if (brewProcess->target == ProcessTarget::VOLUMETRIC) {
            lv_obj_clear_flag(ui_StatusScreen_brewVolume, LV_OBJ_FLAG_HIDDEN);
        }
        lv_obj_add_flag(ui_StatusScreen_barContainer, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(ui_StatusScreen_labelContainer, LV_OBJ_FLAG_HIDDEN);
        lv_label_set_text_fmt(ui_StatusScreen_brewVolume, "%.1lfg", brewProcess->currentVolume);
        lv_imgbtn_set_src(ui_StatusScreen_pauseButton, LV_IMGBTN_STATE_RELEASED, nullptr, &ui_img_631115820, nullptr);
    }
}

void DefaultUI::adjustDials(lv_obj_t *dials) {
    lv_obj_t *tempTarget = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPTARGET);
    lv_obj_t *tempGauge = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPGAUGE);
    lv_obj_t *tempText = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPTEXT);
    lv_obj_t *pressureTarget = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSURETARGET);
    lv_obj_t *pressureGauge = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSUREGAUGE);
    lv_obj_t *pressureText = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSURETEXT);
    _ui_flag_modify(pressureTarget, LV_OBJ_FLAG_HIDDEN, 0);
    _ui_flag_modify(pressureGauge, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    _ui_flag_modify(pressureText, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    lv_obj_set_x(tempText, pressureAvailable ? -50 : 0);
    lv_obj_set_y(tempText, pressureAvailable ? -205 : -180);
    lv_arc_set_bg_angles(tempGauge, 118, pressureAvailable ? 242 : 62);
}

void DefaultUI::loopTask(void *arg) {
    auto *ui = static_cast<DefaultUI *>(arg);
    while (true) {
        ui->loop();
        vTaskDelay(25 / portTICK_PERIOD_MS);
    }
}
