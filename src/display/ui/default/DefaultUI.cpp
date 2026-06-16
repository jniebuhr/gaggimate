#include "DefaultUI.h"

#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/Process.h>
#include <display/core/zones.h>
#ifndef GAGGIMATE_SIM // hardware panel drivers are device-only
#include <display/drivers/AmoledDisplayDriver.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#include <display/drivers/common/LV_Helper.h>
#endif
#include <display/main.h>
#include <display/ui/utils/effects.h>
#include <utility>

#include "esp_sntp.h"

#include <display/ui/default/eez/ui.h>

static EffectManager effect_mgr;

// Format a millisecond duration as "m:ss" for the brew/profile time labels.
static void formatDuration(unsigned long ms, char *buf, size_t len) {
    const double seconds = ms / 1000.0;
    const int minutes = static_cast<int>(seconds / 60.0);
    const int secs = static_cast<int>(seconds) % 60;
    snprintf(buf, len, "%d:%02d", minutes, secs);
}

static float clampPercentage(float pct) { return pct < 0.0f ? 0.0f : (pct > 100.0f ? 100.0f : pct); }

int16_t calculate_angle(int set_temp, int range, int offset) {
    const double percentage = static_cast<double>(set_temp) / static_cast<double>(MAX_TEMP);
    return (percentage * ((double)range)) - range / 2 - offset;
}

void DefaultUI::updateTempHistory() {
    if (currentTemp > 0) {
        if (tempHistoryIndex >= TEMP_HISTORY_LENGTH) {
            tempHistoryIndex = 0;
            isTempHistoryInitialized = true;
        }
        tempHistory[tempHistoryIndex] = currentTemp;
        tempHistoryIndex += 1;
    }

    if (tempHistoryIndex % 4 == 0) {
        heatingFlash = !heatingFlash;
        rerender = true;
    }
}

void DefaultUI::updateTempStableFlag() {
    if (isTempHistoryInitialized) {
        float totalError = 0.0f;
        float maxError = 0.0f;
        for (uint16_t i = 0; i < TEMP_HISTORY_LENGTH; i++) {
            float error = abs(tempHistory[i] - targetTemp);
            totalError += error;
            maxError = error > maxError ? error : maxError;
        }

        const float avgError = totalError / TEMP_HISTORY_LENGTH;
        const float errorMargin = max(2.0f, static_cast<float>(targetTemp) * 0.02f);

        isTemperatureStable = avgError < errorMargin && maxError <= errorMargin;
    }

    // instantly reset stability if setpoint has changed
    if (prevTargetTemp != targetTemp) {
        isTemperatureStable = false;
    }

    prevTargetTemp = targetTemp;
}

void DefaultUI::adjustHeatingIndicator(lv_obj_t *dials) {
    // lv_obj_t *heatingIcon = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPICON);
    // lv_obj_set_style_img_recolor(heatingIcon, lv_color_hex(isTemperatureStable ? 0x00D100 : 0xF62C2C),
    //                              LV_PART_MAIN | LV_STATE_DEFAULT);
    // if (!isTemperatureStable) {
    //     lv_obj_set_style_opa(heatingIcon, heatingFlash ? LV_OPA_50 : LV_OPA_100, LV_PART_MAIN | LV_STATE_DEFAULT);
    // }
}

void DefaultUI::reloadProfiles() { profileLoaded = 0; }

DefaultUI::DefaultUI(Controller *controller, Driver *driver, PluginManager *pluginManager)
    : controller(controller), panelDriver(driver), pluginManager(pluginManager) {
    setupPanel();
}

void DefaultUI::init() {
    profileManager = controller->getProfileManager();
    auto triggerRender = [this](Event const &) { rerender = true; };
    pluginManager->on("boiler:currentTemperature:change", [=](Event const &event) {
        int newTemp = static_cast<int>(event.getFloat("value"));
        if (newTemp != currentTemp) {
            currentTemp = newTemp;
            rerender = true;
        }
    });
    pluginManager->on("boiler:pressure:change", [=](Event const &event) {
        float newPressure = event.getFloat("value");
        if (round(newPressure * 10.0f) != round(pressure * 10.0f)) {
            pressure = newPressure;
            rerender = true;
        }
    });
    pluginManager->on("boiler:targetTemperature:change", [=](Event const &event) {
        int newTemp = static_cast<int>(event.getFloat("value"));
        if (newTemp != targetTemp) {
            targetTemp = newTemp;
            rerender = true;
        }
    });
    pluginManager->on("controller:targetVolume:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:targetDuration:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:grindDuration:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:grindVolume:change", [=](Event const &event) { rerender = true; });
    pluginManager->on("controller:process:end", triggerRender);
    pluginManager->on("controller:process:start", triggerRender);
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        mode = event.getInt("value");
        switch (mode) {
        case MODE_STANDBY:
            changeScreen(SCREEN_ID_STANDBY_SCREEN);
            break;
        case MODE_BREW:
            changeScreen(SCREEN_ID_BREW_SCREEN);
            break;
        case MODE_GRIND:
            changeScreen(SCREEN_ID_GRIND_SCREEN);
            break;
        case MODE_STEAM:
            changeScreen(SCREEN_ID_STEAM_SCREEN);
            break;
        case MODE_WATER:
            changeScreen(SCREEN_ID_WATER_SCREEN);
            break;
        default:
            break;
        };
    });
    pluginManager->on("controller:brew:start", [this](Event const &event) { changeScreen(SCREEN_ID_STATUS_SCREEN); });
    pluginManager->on("controller:brew:clear", [this](Event const &event) {
        if (eez_flow_get_current_screen() == SCREEN_ID_STATUS_SCREEN) {
            changeScreen(SCREEN_ID_BREW_SCREEN);
        }
    });
    pluginManager->on("controller:bluetooth:waiting", [this](Event const &) {
        waitingForController = true;
        rerender = true;
    });
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        waitingForController = false;
        rerender = true;
        initialized = true;
        // Stay on the standby screen when the controller is incompatible so the
        // mismatch message remains visible instead of jumping into brew.
        if (eez_flow_get_current_screen() == SCREEN_ID_STANDBY_SCREEN && !controller->getSystemInfo().protocolMismatch) {
            ::Settings &settings = controller->getSettings();
            if (settings.getStartupMode() == MODE_BREW) {
                changeScreen(SCREEN_ID_BREW_SCREEN);
            } else {
                standbyEnterTime = ::millis();
            }
        }
        pressureAvailable = controller->getSystemInfo().capabilities.pressure;
    });
    pluginManager->on("controller:bluetooth:disconnect", [this](Event const &) {
        waitingForController = true;
        rerender = true;
    });
    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        rerender = true;
        apActive = event.getInt("AP");
    });
    pluginManager->on("ota:update:start", [this](Event const &) {
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("ota:update:end", [this](Event const &) {
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("ota:update:status", [this](Event const &event) {
        rerender = true;
        updateAvailable = event.getInt("value");
    });
    pluginManager->on("controller:error", [this](Event const &) {
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("controller:protocol:mismatch", [this](Event const &) {
        // Incompatible firmware on the other end: control is inhibited (OTA only),
        // so surface it on the standby screen like a runaway error.
        rerender = true;
        changeScreen(SCREEN_ID_STANDBY_SCREEN);
    });
    pluginManager->on("controller:autotune:start", [this](Event const &) { changeScreen(SCREEN_ID_STANDBY_SCREEN); });
    pluginManager->on("controller:autotune:result", [this](Event const &) { changeScreen(SCREEN_ID_STANDBY_SCREEN); });

    pluginManager->on("profiles:profile:select", [this](Event const &event) {
        reloadProfiles();
        rerender = true;
    });
    pluginManager->on("profiles:profile:favorite", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:profile:unfavorite", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:profile:save", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("controller:volumetric-measurement:bluetooth:change", [=](Event const &event) {
        double newWeight = event.getFloat("value");
        if (round(newWeight * 10.0) != round(bluetoothWeight * 10.0)) {
            bluetoothWeight = newWeight;
            rerender = true;
        }
    });
    xTaskCreatePinnedToCore(loopTask, "DefaultUI::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 1);
    xTaskCreatePinnedToCore(profileLoopTask, "DefaultUI::loopProfiles", configMINIMAL_STACK_SIZE * 4, this, 1, &profileTaskHandle,
                            0);
}

void DefaultUI::loop() {
    const unsigned long now = ::millis();
    const unsigned long diff = now - lastRender;

    if (now - lastTempLog > TEMP_HISTORY_INTERVAL) {
        updateTempHistory();
        lastTempLog = now;
    }

    if ((controller->isActive() && diff > RERENDER_INTERVAL_ACTIVE) || diff > RERENDER_INTERVAL_IDLE) {
        rerender = true;
    }

    if (rerender) {
        rerender = false;
        lastRender = now;
        applyTheme();
        if (controller->isErrorState()) {
            changeScreen(SCREEN_ID_STANDBY_SCREEN);
        }
        updateTempStableFlag();

        updateState();
        // Fill the EEZ data models before handleScreenChange() creates/ticks a screen (undefined fields abort the flow).
        updateSystemStatus();
        updateProfileInfo();
        updateBoiler();
        updateBrewProcess();
        currentWeight = FloatValue(bluetoothWeight);
        eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SCALE_WEIGHT_CURRENT, currentWeight);

        char timeBuf[12];
        formatDuration(controller->getSettings().getTargetGrindDuration(), timeBuf, sizeof(timeBuf));
        grindTimeTarget = StringValue(timeBuf);
        eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_TIME_TARGET, grindTimeTarget);
        grindWeightTarget = FloatValue(controller->getSettings().getTargetGrindVolume());
        eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_WEIGHT_TARGET, grindWeightTarget);

        handleScreenChange();
        currentScreen = static_cast<ScreensEnum>(eez_flow_get_current_screen());
        effect_mgr.evaluate_all();
    }

    ui_tick();
    lv_task_handler();
}

void DefaultUI::loopProfiles() {
    if (!profileLoaded) {
        const auto favoritedIds = profileManager->getFavoritedProfiles();
        favoritedProfileIds.clear();
        favoritedProfiles.clear();
        favoritedProfileIds.reserve(favoritedIds.size() + 1);
        favoritedProfileIds.emplace_back(controller->getSettings().getSelectedProfile());
        for (const auto &id : favoritedIds) {
            if (std::find(favoritedProfileIds.begin(), favoritedProfileIds.end(), id) == favoritedProfileIds.end())
                favoritedProfileIds.emplace_back(id);
        }
        favoritedProfiles.reserve(favoritedProfileIds.size());
        for (const auto &profileId : favoritedProfileIds) {
            Profile profile{};
            profileManager->loadProfile(profileId, profile);
            favoritedProfiles.emplace_back(std::move(profile));
        }
        profileLoaded = 1;
    }
}

void DefaultUI::changeScreen(ScreensEnum screen) {
    targetScreen = screen;
    rerender = true;
    // Reset some submenus
    brewScreenState = BrewScreenState::Brew;
}

void DefaultUI::changeBrewScreenMode(BrewScreenState state) {
    brewScreenState = state;
    rerender = true;
}

void DefaultUI::onProfileSwitch() {
    currentProfileIdx = 0;
    changeScreen(SCREEN_ID_PROFILE_SCREEN);
}

void DefaultUI::onNextProfile() {
    if (currentProfileIdx < favoritedProfileIds.size() - 1) {
        currentProfileIdx++;
    }
    rerender = true;
}

void DefaultUI::onPreviousProfile() {
    if (currentProfileIdx > 0) {
        currentProfileIdx--;
    }
    rerender = true;
}

void DefaultUI::onProfileSelect() {
    profileManager->selectProfile(favoritedProfileIds[currentProfileIdx]);
    profileDirty = false;
    changeScreen(SCREEN_ID_BREW_SCREEN);
}

void DefaultUI::onVolumetricDelete() {
    controller->onVolumetricDelete();
    profileDirty = true;
}

void DefaultUI::setupPanel() {
    ui_init();
    setupState();
    applyTheme();
    ui_tick();
    lv_task_handler();

    delay(100);
    // Set initial brightness based on settings
    const ::Settings &settings = controller->getSettings();
    setBrightness(settings.getMainBrightness());
}

void DefaultUI::setupState() {

    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SCALE_WEIGHT_CURRENT, currentWeight);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_WEIGHT_TARGET, grindWeightTarget);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_GRIND_TIME_TARGET, grindTimeTarget);

    // Register the struct-backed globals once; their ref-counted arrays let later in-place updates show through.
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SYSTEM, systemStatus);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_PREVIEW_PROFILE, previewProfileInfo);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_SELECTED_PROFILE, selectedProfileInfo);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_BOILER, boiler);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_UI_FLAGS, uiFlags);
    eez::flow::setGlobalVariable(FLOW_GLOBAL_VARIABLE_BREW_PROCESS_INFO, brewProcess);

    // Fill every field so the first screen render never reads an undefined struct field.
    updateState();
    updateSystemStatus();
    updateProfileInfo();
    updateBoiler();
    updateBrewProcess();
}

void DefaultUI::setupReactive() {
    // effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; }, [=]() { adjustDials(ui_MenuScreen_dials); },
    //                       &pressureAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; }, [=]() { adjustDials(ui_StatusScreen_dials); },
    //                       &pressureAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; }, [=]() { adjustDials(ui_BrewScreen_dials); },
    //                       &pressureAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; }, [=]() { adjustDials(ui_GrindScreen_dials); },
    //                       &pressureAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() { adjustDials(ui_SimpleProcessScreen_dials); }, &pressureAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; }, [=]() { adjustDials(ui_ProfileScreen_dials); },
    //                       &pressureAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; }, [=]() { adjustHeatingIndicator(ui_BrewScreen_dials);
    // },
    //                       &isTemperatureStable, &heatingFlash);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() { adjustHeatingIndicator(ui_SimpleProcessScreen_dials); }, &isTemperatureStable,
    //                       &heatingFlash);
    // effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; }, [=]() { adjustHeatingIndicator(ui_MenuScreen_dials);
    // },
    //                       &isTemperatureStable, &heatingFlash);
    // effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; },
    //                       [=]() { adjustHeatingIndicator(ui_ProfileScreen_dials); }, &isTemperatureStable, &heatingFlash);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() { adjustHeatingIndicator(ui_GrindScreen_dials); }, &isTemperatureStable, &heatingFlash);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
    //                       [=]() { adjustHeatingIndicator(ui_StatusScreen_dials); }, &isTemperatureStable, &heatingFlash);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() { lv_label_set_text(ui_SimpleProcessScreen_mainLabel5, mode == MODE_STEAM ? "Steam" : "Water");
    //                       }, &mode);
    // effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_MenuScreen_dials_tempGauge, currentTemp);
    //                           lv_label_set_text_fmt(uic_MenuScreen_dials_tempText, "%d°C", currentTemp);
    //                       },
    //                       &currentTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_StatusScreen_dials_tempGauge, currentTemp);
    //                           lv_label_set_text_fmt(uic_StatusScreen_dials_tempText, "%d°C", currentTemp);
    //                       },
    //                       &currentTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_BrewScreen_dials_tempGauge, currentTemp);
    //                           lv_label_set_text_fmt(uic_BrewScreen_dials_tempText, "%d°C", currentTemp);
    //                       },
    //                       &currentTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_GrindScreen_dials_tempGauge, currentTemp);
    //                           lv_label_set_text_fmt(uic_GrindScreen_dials_tempText, "%d°C", currentTemp);
    //                       },
    //                       &currentTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_SimpleProcessScreen_dials_tempGauge, currentTemp);
    //                           lv_label_set_text_fmt(uic_SimpleProcessScreen_dials_tempText, "%d°C", currentTemp);
    //                       },
    //                       &currentTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_ProfileScreen_dials_tempGauge, currentTemp);
    //                           lv_label_set_text_fmt(uic_ProfileScreen_dials_tempText, "%d°C", currentTemp);
    //                       },
    //                       &currentTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; }, [=]() { adjustTempTarget(ui_MenuScreen_dials); },
    //                       &targetTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
    //                       [=]() {
    //                           lv_label_set_text_fmt(ui_StatusScreen_targetTemp, "%d°C", targetTemp);
    //                           adjustTempTarget(ui_StatusScreen_dials);
    //                       },
    //                       &targetTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
    //                       [=]() {
    //                           lv_label_set_text_fmt(ui_BrewScreen_targetTemp, "%d°C", targetTemp);
    //                           adjustTempTarget(ui_BrewScreen_dials);
    //                       },
    //                       &targetTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; }, [=]() { adjustTempTarget(ui_GrindScreen_dials); },
    //                       &targetTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() {
    //                           lv_label_set_text_fmt(ui_SimpleProcessScreen_targetTemp, "%d°C", targetTemp);
    //                           adjustTempTarget(ui_SimpleProcessScreen_dials);
    //                       },
    //                       &targetTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; }, [=]() { adjustTempTarget(ui_ProfileScreen_dials);
    // },
    //                       &targetTemp);
    // effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_MenuScreen_dials_pressureGauge, pressure * 10.0f);
    //                           lv_label_set_text_fmt(uic_MenuScreen_dials_pressureText, "%.1f bar", pressure);
    //                       },
    //                       &pressure);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_StatusScreen_dials_pressureGauge, pressure * 10.0f);
    //                           lv_label_set_text_fmt(uic_StatusScreen_dials_pressureText, "%.1f bar", pressure);
    //                       },
    //                       &pressure);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_BrewScreen_dials_pressureGauge, pressure * 10.0f);
    //                           lv_label_set_text_fmt(uic_BrewScreen_dials_pressureText, "%.1f bar", pressure);
    //                       },
    //                       &pressure);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_GrindScreen_dials_pressureGauge, pressure * 10.0f);
    //                           lv_label_set_text_fmt(uic_GrindScreen_dials_pressureText, "%.1f bar", pressure);
    //                       },
    //                       &pressure);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_SimpleProcessScreen_dials_pressureGauge, pressure * 10.0f);
    //                           lv_label_set_text_fmt(uic_SimpleProcessScreen_dials_pressureText, "%.1f bar", pressure);
    //                       },
    //                       &pressure);
    // effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; },
    //                       [=]() {
    //                           lv_arc_set_value(uic_ProfileScreen_dials_pressureGauge, pressure * 10.0f);
    //                           lv_label_set_text_fmt(uic_ProfileScreen_dials_pressureText, "%.1f bar", pressure);
    //                       },
    //                       &pressure);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StandbyScreen; },
    //                       [=]() {
    //                           updateAvailable ? lv_obj_clear_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN)
    //                                           : lv_obj_add_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN);
    //                       },
    //                       &updateAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_StandbyScreen; },
    //                       [=]() {
    //                           bool deactivated = true;
    //                           if (updateActive) {
    //                               lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Updating...");
    //                           } else if (protocolMismatch) {
    //                               lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Protocol error, please update");
    //                           } else if (error) {
    //                               if (controller->getError() == ERROR_CODE_RUNAWAY) {
    //                                   lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Temperature error, please restart");
    //                               }
    //                           } else if (autotuning) {
    //                               lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Autotuning...");
    //                           } else if (waitingForController) {
    //                               lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Waiting for controller...");
    //                           } else {
    //                               deactivated = !initialized;
    //                           }
    //                           _ui_flag_modify(ui_StandbyScreen_mainLabel, LV_OBJ_FLAG_HIDDEN, deactivated);
    //                           _ui_flag_modify(ui_StandbyScreen_touchIcon, LV_OBJ_FLAG_HIDDEN, !deactivated);
    //                           _ui_flag_modify(ui_StandbyScreen_statusContainer, LV_OBJ_FLAG_HIDDEN, !deactivated);
    //                       },
    //                       &updateAvailable, &error, &protocolMismatch, &autotuning, &waitingForController, &initialized);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
    //                       [=]() {
    //                           if (brewVolumetric) {
    //                               lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%.1fg", targetVolume);
    //                           } else {
    //                               const double secondsDouble = targetDuration;
    //                               const auto minutes = static_cast<int>(secondsDouble / 60.0);
    //                               const auto seconds = static_cast<int>(secondsDouble) % 60;
    //                               lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%2d:%02d", minutes, seconds);
    //                           }
    //                       },
    //                       &targetDuration, &targetVolume, &brewVolumetric);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() {
    //                           if (volumetricMode) {
    //                               lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%.1fg", grindVolume);
    //                           } else {
    //                               const double secondsDouble = grindDuration / 1000.0;
    //                               const auto minutes = static_cast<int>(secondsDouble / 60.0);
    //                               const auto seconds = static_cast<int>(secondsDouble) % 60;
    //                               lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%2d:%02d", minutes, seconds);
    //                           }
    //                       },
    //                       &grindDuration, &grindVolume, &volumetricMode);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
    //                       [=]() {
    //                           lv_img_set_src(ui_BrewScreen_Image4, brewVolumetric ? &ui_img_1424216268 : &ui_img_360122106);
    //                           _ui_flag_modify(ui_BrewScreen_byTimeButton, LV_OBJ_FLAG_HIDDEN, brewVolumetric);
    //                       },
    //                       &brewVolumetric);
    // effect_mgr.use_effect(
    //     [=] { return currentScreen == ui_GrindScreen; },
    //     [=]() {
    //         lv_img_set_src(ui_GrindScreen_targetSymbol, volumetricMode ? &ui_img_1424216268 : &ui_img_360122106);
    //         ui_object_set_themeable_style_property(ui_GrindScreen_weightLabel, LV_PART_MAIN | LV_STATE_DEFAULT,
    //                                                LV_STYLE_TEXT_COLOR,
    //                                                volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
    //         ui_object_set_themeable_style_property(ui_GrindScreen_volumetricButton, LV_PART_MAIN | LV_STATE_DEFAULT,
    //                                                LV_STYLE_IMG_RECOLOR,
    //                                                volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
    //         ui_object_set_themeable_style_property(ui_GrindScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT,
    //         LV_STYLE_BG_COLOR,
    //                                                volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
    //     },
    //     &volumetricMode);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() { _ui_flag_modify(ui_GrindScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN, volumetricAvailable); },
    //                       &volumetricAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
    //                       [=]() {
    //                           if (mode == MODE_STEAM) {
    //                               _ui_flag_modify(ui_SimpleProcessScreen_goButton, LV_OBJ_FLAG_HIDDEN, active);
    //                               lv_imgbtn_set_src(ui_SimpleProcessScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
    //                                                 &ui_img_691326438, nullptr);
    //                           } else {
    //                               lv_imgbtn_set_src(ui_SimpleProcessScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
    //                                                 active ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
    //                           }
    //                       },
    //                       &active, &mode);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() {
    //                           lv_imgbtn_set_src(ui_GrindScreen_startButton, LV_IMGBTN_STATE_RELEASED, nullptr,
    //                                             grindActive ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
    //                       },
    //                       &grindActive);
    //
    // effect_mgr.use_effect(
    //     [=] { return currentScreen == ui_ProfileScreen; },
    //     [=] {
    //         if (profileLoaded) {
    //             _ui_flag_modify(ui_ProfileScreen_profileDetails, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_REMOVE);
    //             _ui_flag_modify(ui_ProfileScreen_loadingSpinner, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_ADD);
    //             lv_label_set_text(ui_ProfileScreen_profileName, favoritedProfiles[currentProfileIdx].label.c_str());
    //             lv_label_set_text(ui_ProfileScreen_mainLabel, currentProfileIdx == 0 ? "Current profile" : "Select profile");
    //
    //             const auto minutes = static_cast<int>(favoritedProfiles[currentProfileIdx].getTotalDuration() / 60.0 - 0.5);
    //             const auto seconds = static_cast<int>(favoritedProfiles[currentProfileIdx].getTotalDuration()) % 60;
    //             lv_label_set_text_fmt(ui_ProfileScreen_targetDuration2, "%2d:%02d", minutes, seconds);
    //             lv_label_set_text_fmt(ui_ProfileScreen_targetTemp2, "%d°C",
    //                                   static_cast<int>(favoritedProfiles[currentProfileIdx].temperature));
    //             unsigned int phaseCount = favoritedProfiles[currentProfileIdx].getPhaseCount();
    //             unsigned int stepCount = favoritedProfiles[currentProfileIdx].phases.size();
    //             lv_label_set_text_fmt(ui_ProfileScreen_stepsLabel, "%d step%s", stepCount, stepCount > 1 ? "s" : "");
    //             lv_label_set_text_fmt(ui_ProfileScreen_phasesLabel, "%d phase%s", phaseCount, phaseCount > 1 ? "s" : "");
    //         } else {
    //             _ui_flag_modify(ui_ProfileScreen_profileDetails, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_ADD);
    //             _ui_flag_modify(ui_ProfileScreen_loadingSpinner, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_REMOVE);
    //         }
    //
    //         ui_object_set_themeable_style_property(ui_ProfileScreen_previousProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT,
    //                                                LV_STYLE_IMG_RECOLOR,
    //                                                currentProfileIdx > 0 ? _ui_theme_color_NiceWhite :
    //                                                _ui_theme_color_SemiDark);
    //         ui_object_set_themeable_style_property(ui_ProfileScreen_previousProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT,
    //                                                LV_STYLE_IMG_RECOLOR_OPA,
    //                                                currentProfileIdx > 0 ? _ui_theme_alpha_NiceWhite :
    //                                                _ui_theme_alpha_SemiDark);
    //         ui_object_set_themeable_style_property(
    //             ui_ProfileScreen_nextProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR,
    //             currentProfileIdx < favoritedProfiles.size() - 1 ? _ui_theme_color_NiceWhite : _ui_theme_color_SemiDark);
    //         ui_object_set_themeable_style_property(
    //             ui_ProfileScreen_nextProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA,
    //             currentProfileIdx < favoritedProfiles.size() - 1 ? _ui_theme_alpha_NiceWhite : _ui_theme_alpha_SemiDark);
    //     },
    //     &currentProfileIdx, &profileLoaded);
    //
    // // Show/hide grind button based on SmartGrind setting or Alt Relay function
    // effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
    //                       [=]() {
    //                           grindAvailable ? lv_obj_clear_flag(ui_MenuScreen_grindBtn, LV_OBJ_FLAG_HIDDEN)
    //                                          : lv_obj_add_flag(ui_MenuScreen_grindBtn, LV_OBJ_FLAG_HIDDEN);
    //                       },
    //                       &grindAvailable);
    // effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
    //                       [=]() {
    //                           if (volumetricAvailable && bluetoothScales) {
    //                               lv_label_set_text_fmt(ui_BrewScreen_weightLabel, "%.1fg", bluetoothWeight);
    //                           } else {
    //                               lv_label_set_text(ui_BrewScreen_weightLabel, "-");
    //                           }
    //                       },
    //                       &bluetoothWeight, &volumetricAvailable, &bluetoothScales);
    // effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
    //                       [=]() {
    //                           if (volumetricAvailable && bluetoothScales) {
    //                               lv_label_set_text_fmt(ui_GrindScreen_weightLabel, "%.1fg", bluetoothWeight);
    //                           } else {
    //                               lv_label_set_text(ui_GrindScreen_weightLabel, "-");
    //                           }
    //                       },
    //                       &bluetoothWeight, &volumetricAvailable, &bluetoothScales);
    // effect_mgr.use_effect(
    //     [=] { return currentScreen == ui_BrewScreen; },
    //     [=]() {
    //         _ui_flag_modify(ui_BrewScreen_adjustments, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
    //         _ui_flag_modify(ui_BrewScreen_acceptButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
    //         _ui_flag_modify(ui_BrewScreen_saveButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
    //         _ui_flag_modify(ui_BrewScreen_saveAsNewButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
    //         _ui_flag_modify(ui_BrewScreen_startButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Brew);
    //         _ui_flag_modify(ui_BrewScreen_profileInfo, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Brew);
    //         _ui_flag_modify(ui_BrewScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN,
    //                         brewScreenState == BrewScreenState::Brew && volumetricAvailable);
    //         if (volumetricAvailable) {
    //             lv_img_set_src(ui_BrewScreen_volumetricButton, bluetoothScales ? &ui_img_1424216268 : &ui_img_flowmeter_png);
    //         }
    //     },
    //     &brewScreenState, &volumetricAvailable, &bluetoothScales);
}

void DefaultUI::handleScreenChange() {
    if (currentScreen != targetScreen) {
        if (targetScreen == SCREEN_ID_STANDBY_SCREEN) {
            standbyEnterTime = ::millis();
        } else if (currentScreen == SCREEN_ID_STANDBY_SCREEN) {
            const ::Settings &settings = controller->getSettings();
            setBrightness(settings.getMainBrightness());
        }
        eez_flow_set_screen(targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0);
        rerender = true;
    }
}

void DefaultUI::updateState() {
    mode = controller->getMode();
    currentTemp = static_cast<int>(controller->getCurrentTemp());
    targetTemp = static_cast<int>(controller->getTargetTemp());
    pressureAvailable = controller->getSystemInfo().capabilities.pressure ? 1 : 0;

    uiFlags.brew_adjustments(brewScreenState == BrewScreenState::Settings);
    uiFlags.active(controller->isActive());
    uiFlags.grind_active(controller->isGrindActive());
    uiFlags.grind_volumetric(controller->isVolumetricAvailable() && controller->getSettings().isVolumetricTarget());
}

void DefaultUI::updateSystemStatus() {
    systemStatus.bluetooth(controller->getClientController()->isConnected());
    systemStatus.wifi(!apActive && WiFi.status() == WL_CONNECTED);
    bool error = !initialized || waitingForController || controller->isErrorState() || controller->isUpdating() ||
                 controller->isAutotuning() || controller->getSystemInfo().protocolMismatch || !controller->isReady();
    systemStatus.error(error);
    systemStatus.error_label(error ? getErrorMessage().c_str() : "");
    systemStatus.scale_connected(controller->isVolumetricAvailable());
    systemStatus.controller_version(controller->getSystemInfo().version.c_str());
    systemStatus.display_version(BUILD_GIT_VERSION);
    systemStatus.update_available(updateAvailable);
    systemStatus.in_menu(currentScreen == SCREEN_ID_MENU_SCREEN);

    char timeBuf[12] = "";
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5)) {
        const ::Settings &settings = controller->getSettings();
        strftime(timeBuf, sizeof(timeBuf), settings.isClock24hFormat() ? "%H:%M" : "%I:%M %p", &timeinfo);
    }
    systemStatus.time(timeBuf);
}

static void populateProfileInfo(ProfileInfoValue &info, const Profile &profile, bool isCurrent) {
    char timeBuf[12];
    formatDuration(static_cast<unsigned long>(profile.getTotalDuration() * 1000.0f), timeBuf, sizeof(timeBuf));
    info.name(profile.label.c_str());
    info.temperature(profile.temperature);
    info.time(timeBuf);
    info.phases(static_cast<int>(profile.getPhaseCount()));
    info.steps(static_cast<int>(profile.phases.size()));
    info.is_volumetric(profile.isVolumetric());
    info.is_current(isCurrent);
    info.target_weight(profile.getTotalVolume());
}

void DefaultUI::updateProfileInfo() {
    if (!initialized) {
        return;
    }
    populateProfileInfo(selectedProfileInfo, profileManager->getSelectedProfile(), true);
    selectedProfileInfo.dirty(profileDirty);

    // Preview backs the ProfileScreen carousel (index 0 = selected); bounds-check as the list is built on another task.
    if (!favoritedProfiles.empty() && currentProfileIdx >= 0 && currentProfileIdx < static_cast<int>(favoritedProfiles.size())) {
        populateProfileInfo(previewProfileInfo, favoritedProfiles[currentProfileIdx], currentProfileIdx == 0);
    } else {
        populateProfileInfo(previewProfileInfo, profileManager->getSelectedProfile(), true);
    }
}

void DefaultUI::updateBoiler() {
    const ::Settings &settings = controller->getSettings();
    boiler.current_temperature(controller->getCurrentTemp());
    boiler.target_temperature(controller->getTargetTemp());
    boiler.current_pressure(pressure);
    boiler.target_pressure(controller->getTargetPressure());
    boiler.max_temperature(160.0f);
    boiler.max_pressure(settings.getPressureScaling());
}

// Mirror the live BrewProcess into brew_process_info; every field must stay valid/typed or the StatusScreen flow aborts.
void DefaultUI::updateBrewProcess() {
    const Profile &selected = profileManager->getSelectedProfile();
    char buf[12];

    // Profile-derived defaults so the struct is valid even before a process runs.
    formatDuration(static_cast<unsigned long>(selected.getTotalDuration() * 1000.0f), buf, sizeof(buf));
    brewProcess.profile_temperature(selected.temperature);
    brewProcess.profile_time(buf);
    brewProcess.profile_phases(static_cast<int>(selected.getPhaseCount()));
    brewProcess.profile_steps(static_cast<int>(selected.phases.size()));
    brewProcess.profile_is_volumetric(selected.isVolumetric());
    brewProcess.profile_is_current(true);
    brewProcess.profile_target_weight(selected.getTotalVolume());
    brewProcess.boiler_target_temperature(controller->getTargetTemp());

    // Copy + re-validate the process pointer against the controller before dereferencing (control task may swap it).
    Process *process = controller->getProcess();
    if (process == nullptr) {
        process = controller->getLastProcess();
    }
    const bool validBrew = process != nullptr && process->getType() == MODE_BREW &&
                           (process == controller->getProcess() || process == controller->getLastProcess());
    if (!validBrew) {
        brewProcess.phase_type("");
        brewProcess.phase_name("");
        brewProcess.phase_value_current(0.0f);
        brewProcess.phase_value_target(0.0f);
        brewProcess.phase_value_is_weight(false);
        brewProcess.elapsed_time("0:00");
        brewProcess.elapsed_percentage(0.0f);
        brewProcess.is_complete(false);
        return;
    }

    auto *bp = static_cast<BrewProcess *>(process);
    if (bp->profile.phases.empty() || bp->phaseIndex >= bp->profile.phases.size()) {
        // Object is mid-mutation/invalid: keep the last valid values.
        return;
    }

    const Phase phase = bp->currentPhase;
    const bool active = process->isActive();

    // Live profile fields from the running process.
    formatDuration(bp->getTotalDuration(), buf, sizeof(buf));
    brewProcess.profile_temperature(bp->profile.temperature);
    brewProcess.profile_time(buf);
    brewProcess.profile_phases(static_cast<int>(bp->profile.getPhaseCount()));
    brewProcess.profile_steps(static_cast<int>(bp->profile.phases.size()));
    brewProcess.profile_is_volumetric(bp->target == ProcessTarget::VOLUMETRIC);
    brewProcess.profile_target_weight(bp->getBrewVolume());
    brewProcess.boiler_target_temperature(bp->getTemperature());

    brewProcess.phase_type(phase.phase == PhaseType::PHASE_TYPE_BREW ? "BREW" : "INFUSION");

    String phaseName = "Finished";
    if (active) {
        phaseName = phase.name;
    } else if (controller->getSettings().isDelayAdjust() && !process->isComplete()) {
        phaseName = "Calibrating...";
    }
    brewProcess.phase_name(phaseName.c_str());

    unsigned long now = ::millis();
    if (!active && bp->finished > 0) {
        now = bp->finished;
    }
    const unsigned long elapsedMs = (bp->processStarted > 0 && now >= bp->processStarted) ? now - bp->processStarted : 0;
    formatDuration(elapsedMs, buf, sizeof(buf));
    brewProcess.elapsed_time(buf);

    const bool weightTarget = bp->target == ProcessTarget::VOLUMETRIC && phase.hasVolumetricTarget();
    brewProcess.phase_value_is_weight(weightTarget);
    if (weightTarget) {
        const float target = phase.getVolumetricTarget().value;
        const float current = static_cast<float>(bp->currentVolume);
        brewProcess.phase_value_current(current);
        brewProcess.phase_value_target(target);
        brewProcess.elapsed_percentage(target > 0.0f ? clampPercentage(current / target * 100.0f) : 0.0f);
    } else {
        const unsigned long phaseElapsed =
            (bp->currentPhaseStarted > 0 && now >= bp->currentPhaseStarted) ? now - bp->currentPhaseStarted : 0;
        const float current = phaseElapsed / 1000.0f;
        const float target = bp->getPhaseDuration() / 1000.0f;
        brewProcess.phase_value_current(current);
        brewProcess.phase_value_target(target);
        brewProcess.elapsed_percentage(target > 0.0f ? clampPercentage(current / target * 100.0f) : 0.0f);
    }

    brewProcess.is_complete(process->isComplete());
}

String DefaultUI::getErrorMessage() {
    if (controller->isUpdating()) {
        return "Updating...";
    }
    if (controller->isAutotuning()) {
        return "Autotuning...";
    }
    if (controller->getSystemInfo().protocolMismatch) {
        return controller->getSystemInfo().protocolVersion > gm_proto::PROTOCOL_VERSION ? "Version mismatch, update display"
                                                                                        : "Version mismatch, update controller";
    }
    if (controller->isErrorState()) {
        switch (controller->getError()) {
        case ERROR_CODE_RUNAWAY:
            return "Temperature error, restart...";
        default:
            return "Unknown error";
        }
    }
    if (waitingForController) {
        return "Waiting for controller...";
    }
    return initialized ? "" : "Starting...";
}

void DefaultUI::adjustDials(lv_obj_t *dials) {
    // lv_obj_t *tempGauge = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPGAUGE);
    // lv_obj_t *tempText = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPTEXT);
    // lv_obj_t *pressureTarget = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSURETARGET);
    // lv_obj_t *pressureGauge = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSUREGAUGE);
    // lv_obj_t *pressureText = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSURETEXT);
    // lv_obj_t *pressureSymbol = ui_comp_get_child(dials, UI_COMP_DIALS_IMAGE6);
    // _ui_flag_modify(pressureTarget, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    // _ui_flag_modify(pressureGauge, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    // _ui_flag_modify(pressureText, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    // _ui_flag_modify(pressureSymbol, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    // lv_obj_set_x(tempText, pressureAvailable ? -50 : 0);
    // lv_obj_set_y(tempText, pressureAvailable ? -205 : -180);
    // lv_arc_set_bg_angles(tempGauge, 118, pressureAvailable ? 242 : 62);
    // lv_arc_set_range(pressureGauge, 0, pressureScaling * 10);
}

void DefaultUI::applyTheme() {
    const ::Settings &settings = controller->getSettings();
    int newThemeMode = settings.getThemeMode();

    if (newThemeMode != currentThemeMode) {
        currentThemeMode = newThemeMode;
        change_color_theme(currentThemeMode);
        // ui_theme_set(currentThemeMode);

#ifndef GAGGIMATE_SIM // Amoled-specific black theme override is device-only
        if (AmoledDisplayDriver::getInstance() == panelDriver && currentThemeMode == THEME_ID_DARK) {
            enable_amoled_black_theme_override(lv_disp_get_default());
        }
#endif
    }
}

void DefaultUI::adjustTarget(lv_obj_t *obj, double percentage, double start, double range) const {
    double angle = start + range - range * percentage;

    lv_img_set_angle(obj, angle * -10);
    int x = static_cast<int>(std::cos(angle * M_PI / 180.0f) * 235.0);
    int y = static_cast<int>(std::sin(angle * M_PI / 180.0f) * -235.0);
    lv_obj_set_pos(obj, x, y);
}

void DefaultUI::loopTask(void *arg) {
    auto *ui = static_cast<DefaultUI *>(arg);
    while (true) {
        ui->loop();
        vTaskDelay(25 / portTICK_PERIOD_MS);
    }
}

void DefaultUI::profileLoopTask(void *arg) {
    auto *ui = static_cast<DefaultUI *>(arg);
    while (true) {
        ui->loopProfiles();
        vTaskDelay(25 / portTICK_PERIOD_MS);
    }
}
