#include "DefaultUI.h"

#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/Process.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#include <display/drivers/common/LV_Helper.h>

int16_t calculate_angle(int set_temp) {
    constexpr int16_t angleRange = 3160;
    const double percentage = static_cast<double>(set_temp) / static_cast<double>(MAX_TEMP);
    return (percentage * ((double)angleRange)) - angleRange / 2;
}

DefaultUI::DefaultUI(Controller *controller, PluginManager *pluginManager)
    : controller(controller), pluginManager(pluginManager) {}

void DefaultUI::init() {
    auto triggerRender = [this](Event const &) { rerender = true; };
    pluginManager->on("boiler:currentTemperature:change", triggerRender);
    pluginManager->on("boiler:targetTemperature:change", triggerRender);
    pluginManager->on("controller:targetVolume:change", triggerRender);
    pluginManager->on("controller:grindDuration:change", triggerRender);
    pluginManager->on("controller:targetDuration:change", triggerRender);
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
        bluetoothActive = true;
        rerender = true;
        if (lv_scr_act() == ui_InitScreen) {
            Settings &settings = controller->getSettings();
            settings.getStartupMode() == MODE_BREW ? changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init)
                                                   : changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
        }
    });
    pluginManager->on("controller:bluetooth:disconnect", [this](Event const &) {
        rerender = true;
        bluetoothActive = false;
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
    pluginManager->on("ota:update:status", [this](Event const &event) {
        rerender = true;
        updateAvailable = event.getInt("value");
    });

    setupPanel();
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
        handleScreenChange();
        if (lv_scr_act() == ui_StandbyScreen)
            updateStandbyScreen();
        if (lv_scr_act() == ui_BrewScreen)
            updateBrewScreen();
        if (lv_scr_act() == ui_StatusScreen)
            updateStatusScreen();
        if (lv_scr_act() == ui_SteamScreen)
            updateSteamScreen();
        if (lv_scr_act() == ui_WaterScreen)
            updateWaterScreen();
        if (lv_scr_act() == ui_GrindScreen)
            updateGrindScreen();
        if (lv_scr_act() == ui_MenuScreen)
            updateMenuScreen();
    }

    lv_timer_handler();
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

void DefaultUI::handleScreenChange() const {
    if (const lv_obj_t *current = lv_scr_act(); current != *targetScreen) {
        _ui_screen_change(targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0, targetScreenInit);
    }
}

void DefaultUI::updateStandbyScreen() const {
    if (!apActive && WiFi.status() == WL_CONNECTED) {
        struct tm timeinfo;
        if (getLocalTime(&timeinfo, 50)) {
            char time[6];
            strftime(time, 6, "%H:%M", &timeinfo);
            lv_label_set_text(ui_StandbyScreen_time, time);
            lv_obj_clear_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
        }
    } else {
        lv_obj_add_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
    }
    bluetoothActive ? lv_obj_clear_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN)
                    : lv_obj_add_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN);
    !apActive &&WiFi.status() == WL_CONNECTED ? lv_obj_clear_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN)
                                              : lv_obj_add_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN);
    updateAvailable ? lv_obj_clear_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN)
                    : lv_obj_add_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN);
}

void DefaultUI::updateMenuScreen() const {
    lv_arc_set_value(ui_MenuScreen_tempGauge, controller->getCurrentTemp());
    lv_label_set_text_fmt(ui_MenuScreen_tempText, "%d°C", controller->getCurrentTemp());
    const int16_t setTemp = controller->getTargetTemp();
    lv_img_set_angle(ui_MenuScreen_tempTarget, calculate_angle(setTemp));
}

void DefaultUI::updateStatusScreen() const {
    lv_arc_set_value(ui_StatusScreen_tempGauge, controller->getCurrentTemp());
    lv_label_set_text_fmt(ui_StatusScreen_tempText, "%d°C", controller->getCurrentTemp());
    const int16_t setTemp = controller->getTargetTemp();
    lv_label_set_text_fmt(ui_StatusScreen_targetTemp, "%d°C", setTemp);
    lv_img_set_angle(ui_StatusScreen_tempTarget, calculate_angle(setTemp));
    Settings &settings = controller->getSettings();

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

void DefaultUI::updateBrewScreen() const {
    lv_arc_set_value(ui_BrewScreen_tempGauge, controller->getCurrentTemp());
    lv_label_set_text_fmt(ui_BrewScreen_tempText, "%d°C", controller->getCurrentTemp());
    const int16_t setTemp = controller->getTargetTemp();
    lv_label_set_text_fmt(ui_BrewScreen_targetTemp, "%d°C", setTemp);
    lv_img_set_angle(ui_BrewScreen_tempTarget, calculate_angle(setTemp));
    const Settings &settings = controller->getSettings();

    const bool volumetricAvailable = controller->isVolumetricAvailable();
    const bool volumetricMode = volumetricAvailable && settings.isVolumetricTarget();

    if (volumetricAvailable) {
        lv_obj_clear_flag(ui_BrewScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(ui_BrewScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
    }

    if (volumetricMode) {
        lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%dg", settings.getTargetVolume());
    } else {
        const double secondsDouble = settings.getTargetDuration() / 1000.0;
        const auto minutes = static_cast<int>(secondsDouble / 60.0 - 0.5);
        const auto seconds = static_cast<int>(secondsDouble) % 60;
        lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%2d:%02d", minutes, seconds);
    }

    lv_img_set_src(ui_BrewScreen_Image4, volumetricMode ? &ui_img_1424216268 : &ui_img_360122106);
    ui_object_set_themeable_style_property(ui_BrewScreen_timedButton, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_IMG_RECOLOR,
                                           volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(ui_BrewScreen_volumetricButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BG_IMG_RECOLOR,
                                           volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_BrewScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_BrewScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_GRAD_COLOR,
                                           volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
}

void DefaultUI::updateGrindScreen() const {
    const Settings &settings = controller->getSettings();

    const bool volumetricAvailable = controller->isVolumetricAvailable();
    const bool volumetricMode = volumetricAvailable && settings.isVolumetricTarget();

    if (volumetricAvailable) {
        lv_obj_clear_flag(ui_GrindScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(ui_GrindScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN);
    }

    if (volumetricMode) {
        lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%dg", settings.getTargetGrindVolume());
    } else {
        const double secondsDouble = settings.getTargetGrindDuration() / 1000.0;
        const auto minutes = static_cast<int>(secondsDouble / 60.0 - 0.5);
        const auto seconds = static_cast<int>(secondsDouble) % 60;
        lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%2d:%02d", minutes, seconds);
    }

    lv_arc_set_value(ui_GrindScreen_tempGauge, controller->getCurrentTemp());
    lv_label_set_text_fmt(ui_GrindScreen_tempText, "%d°C", controller->getCurrentTemp());
    const int16_t setTemp = controller->getTargetTemp();
    lv_img_set_angle(ui_GrindScreen_tempTarget, calculate_angle(setTemp));
    lv_imgbtn_set_src(ui_GrindScreen_startButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                      controller->isGrindActive() ? &ui_img_1456692430 : &ui_img_445946954, nullptr);

    lv_img_set_src(ui_GrindScreen_targetSymbol, volumetricMode ? &ui_img_1424216268 : &ui_img_360122106);
    ui_object_set_themeable_style_property(ui_GrindScreen_timedButton, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_IMG_RECOLOR,
                                           volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(ui_GrindScreen_volumetricButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BG_IMG_RECOLOR,
                                           volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_GrindScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_GrindScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_GRAD_COLOR,
                                           volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
}

void DefaultUI::updateWaterScreen() const {
    lv_arc_set_value(ui_WaterScreen_tempGauge, controller->getCurrentTemp());
    lv_label_set_text_fmt(ui_WaterScreen_tempText, "%d°C", controller->getCurrentTemp());
    const int16_t setTemp = controller->getTargetTemp();
    lv_label_set_text_fmt(ui_WaterScreen_targetTemp, "%d°C", setTemp);
    lv_img_set_angle(ui_WaterScreen_tempTarget, calculate_angle(setTemp));
    lv_imgbtn_set_src(ui_WaterScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                      controller->isActive() ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
}

void DefaultUI::updateSteamScreen() const {
    lv_arc_set_value(ui_SteamScreen_tempGauge, controller->getCurrentTemp());
    lv_label_set_text_fmt(ui_SteamScreen_tempText, "%d°C", controller->getCurrentTemp());
    const int16_t setTemp = controller->getTargetTemp();
    lv_label_set_text_fmt(ui_SteamScreen_targetTemp, "%d°C", setTemp);
    lv_img_set_angle(ui_SteamScreen_tempTarget, calculate_angle(setTemp));
    lv_imgbtn_set_src(ui_SteamScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                      controller->isActive() ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
}
