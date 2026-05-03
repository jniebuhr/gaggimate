#include "DefaultUI.h"

#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/Process.h>
#include <display/core/zones.h>
#include <display/drivers/AmoledDisplayDriver.h>
#include <display/drivers/LilyGoDriver.h>
#include <display/drivers/WaveshareDriver.h>
#include <display/drivers/common/LV_Helper.h>
#include <display/main.h>
#include <display/ui/default/lvgl/ui_theme_manager.h>
#include <display/ui/default/lvgl/ui_themes.h>
#include <display/ui/utils/effects.h>

#include "esp_sntp.h"

static EffectManager effect_mgr;

namespace {
constexpr lv_opa_t OPA_45 = static_cast<lv_opa_t>(45);
constexpr lv_opa_t OPA_55 = static_cast<lv_opa_t>(55);
constexpr lv_opa_t OPA_185 = static_cast<lv_opa_t>(185);
constexpr lv_opa_t OPA_190 = static_cast<lv_opa_t>(190);
constexpr lv_opa_t OPA_200 = static_cast<lv_opa_t>(200);
constexpr lv_opa_t OPA_210 = static_cast<lv_opa_t>(210);
constexpr lv_opa_t OPA_220 = static_cast<lv_opa_t>(220);
} // namespace

int16_t calculate_angle(int set_temp, int range, int offset) {
    const double percentage = static_cast<double>(set_temp) / static_cast<double>(MAX_TEMP);
    return (percentage * ((double)range)) - range / 2 - offset;
}

void DefaultUI::updateTempHistory() {
    if (currentTemp > 0) {
        tempHistory[tempHistoryIndex] = currentTemp;
        tempHistoryIndex += 1;
    }

    if (tempHistoryIndex > TEMP_HISTORY_LENGTH) {
        tempHistoryIndex = 0;
        isTempHistoryInitialized = true;
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
    lv_obj_t *heatingIcon = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPICON);
    lv_obj_set_style_img_recolor(heatingIcon, lv_color_hex(isTemperatureStable ? 0x00D100 : 0xF62C2C),
                                 LV_PART_MAIN | LV_STATE_DEFAULT);
    if (!isTemperatureStable) {
        lv_obj_set_style_opa(heatingIcon, heatingFlash ? LV_OPA_50 : LV_OPA_100, LV_PART_MAIN | LV_STATE_DEFAULT);
    }
}

void DefaultUI::reloadProfiles() { profileLoaded = 0; }

DefaultUI::DefaultUI(Controller *controller, Driver *driver, PluginManager *pluginManager)
    : controller(controller), panelDriver(driver), pluginManager(pluginManager) {
    setupPanel();
}

namespace {
struct DisplayPalette {
    lv_color_t surface;
    lv_color_t surfaceStrong;
    lv_color_t surfaceElevated;
    lv_color_t surfaceOutline;
    lv_color_t ringTrack;
    lv_color_t standby;
    lv_color_t accent;
    lv_color_t accentCool;
    lv_color_t water;
    lv_color_t grind;
    lv_color_t success;
    lv_color_t warning;
    lv_color_t danger;
    lv_color_t textPrimary;
    lv_color_t textMuted;
    lv_color_t textDisabled;
};

struct RingVisual {
    int value;
    lv_color_t tone;
    const char *title;
};

int resolveDisplayThemeMode(const int requestedThemeMode, const bool amoledPanel) {
    if (amoledPanel) {
        return UI_THEME_DEFAULT;
    }

    return requestedThemeMode == UI_THEME_LIGHT ? UI_THEME_LIGHT : UI_THEME_DEFAULT;
}

DisplayPalette makeDisplayPalette(const int themeMode, const bool amoledPanel) {
    const int resolvedThemeMode = resolveDisplayThemeMode(themeMode, amoledPanel);

    if (resolvedThemeMode == UI_THEME_DEFAULT) {
        return {
            lv_color_hex(0x050505),
            lv_color_hex(0x0B0B0B),
            lv_color_hex(0x111111),
            lv_color_hex(0x2A2A2A),
            lv_color_hex(0x1E1E1E),
            lv_color_hex(0x333333),
            lv_color_hex(0xD71921),
            lv_color_hex(0xD4A843),
            lv_color_hex(0x6699CC),
            lv_color_hex(0x7CB876),
            lv_color_hex(0x7CB876),
            lv_color_hex(0xD4A843),
            lv_color_hex(0xD71921),
            lv_color_hex(0xFFFFFF),
            lv_color_hex(0x999999),
            lv_color_hex(0x666666),
        };
    }

    return {
        lv_color_hex(0xFFFFFF),
        lv_color_hex(0xFAFAFA),
        lv_color_hex(0xF5F5F5),
        lv_color_hex(0xDADADA),
        lv_color_hex(0xEDEDED),
        lv_color_hex(0xCCCCCC),
        lv_color_hex(0xD71921),
        lv_color_hex(0xD4A843),
        lv_color_hex(0x6699CC),
        lv_color_hex(0x7CB876),
        lv_color_hex(0x7CB876),
        lv_color_hex(0xD4A843),
        lv_color_hex(0xD71921),
        lv_color_hex(0x000000),
        lv_color_hex(0x1A1A1A),
        lv_color_hex(0x666666),
    };
}

int clampPercent(const double value) {
    if (value < 0.0)
        return 0;
    if (value > 100.0)
        return 100;
    return static_cast<int>(round(value));
}

int temperatureProgress(const int currentTemperature, const int targetTemperature) {
    if (targetTemperature <= 0)
        return 0;
    return clampPercent(static_cast<double>(currentTemperature) / static_cast<double>(targetTemperature) * 100.0);
}

lv_color_t modeTone(const DisplayPalette &palette, const int mode) {
    switch (mode) {
    case MODE_BREW:
        return palette.accent;
    case MODE_STEAM:
        return palette.accentCool;
    case MODE_WATER:
        return palette.water;
    case MODE_GRIND:
        return palette.grind;
    case MODE_STANDBY:
    default:
        return palette.standby;
    }
}

RingVisual buildRingVisual(const DisplayPalette &palette, const int mode, const int currentTemperature,
                           const int targetTemperature, const bool active, const bool grindActive, Controller *controller) {
    if (mode == MODE_BREW) {
        ProcessSnapshot proc = controller->getProcessSnapshot();
        if (proc.exists && proc.isBrew) {
            if (proc.isActive) {
                int progress = 0;
                if (proc.target == ProcessTarget::VOLUMETRIC && proc.hasVolumetricTarget && proc.volumetricTargetValue > 0.0f) {
                    progress = clampPercent((proc.currentVolume / proc.volumetricTargetValue) * 100.0);
                } else if (proc.phaseDuration > 0 && proc.currentPhaseStarted > 0) {
                    progress = clampPercent((static_cast<double>(millis() - proc.currentPhaseStarted) /
                                             static_cast<double>(proc.phaseDuration)) *
                                            100.0);
                }
                return {progress, palette.success, "BREWING"};
            }
            if (proc.finished > 0) {
                return {100, palette.success, "FINISHED"};
            }
        }
    }

    if (active) {
        return {100, modeTone(palette, mode), "ACTIVE"};
    }

    switch (mode) {
    case MODE_BREW:
        return {temperatureProgress(currentTemperature, targetTemperature), palette.accent,
                currentTemperature < targetTemperature ? "HEATING" : "BREW"};
    case MODE_STEAM: {
        const int steamTarget = targetTemperature > 120 ? targetTemperature : 150;
        return {temperatureProgress(currentTemperature, steamTarget), palette.accentCool,
                currentTemperature < steamTarget ? "PREHEATING" : "STEAM"};
    }
    case MODE_WATER:
        return {temperatureProgress(currentTemperature, targetTemperature > 0 ? targetTemperature : 80), palette.water, "WATER"};
    case MODE_GRIND:
        return {grindActive ? 100 : 8, palette.grind, grindActive ? "GRINDING" : "GRIND"};
    case MODE_STANDBY:
    default:
        return {temperatureProgress(currentTemperature, 93), palette.standby, "STANDBY"};
    }
}

void stylePanel(lv_obj_t *obj, const DisplayPalette &palette, const lv_opa_t opa = LV_OPA_80, const lv_coord_t radius = 28) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    lv_obj_set_style_radius(obj, radius, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(obj, palette.surfaceStrong, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_color(obj, palette.surfaceElevated, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_NONE, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(obj, opa, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(obj, palette.surfaceOutline, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_opa(obj, LV_OPA_60, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(obj, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_opa(obj, LV_OPA_0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_spread(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_ofs_x(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_ofs_y(obj, 4, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleChip(lv_obj_t *obj, const DisplayPalette &palette, const lv_color_t tone, const bool subtle = false) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    lv_obj_set_style_text_color(obj, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(obj, subtle ? palette.surfaceElevated : tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(obj, subtle ? OPA_190 : LV_OPA_40, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(obj, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_opa(obj, LV_OPA_70, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(obj, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_radius(obj, 999, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_left(obj, 12, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_right(obj, 12, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_top(obj, 7, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_bottom(obj, 7, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(obj, &ndot_18, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_letter_space(obj, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleHeadline(lv_obj_t *obj, const DisplayPalette &palette, const bool emphasis = false) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    lv_obj_set_style_text_color(obj, palette.textPrimary, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_opa(obj, emphasis ? LV_OPA_COVER : LV_OPA_90, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_letter_space(obj, emphasis ? 1 : 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(obj, emphasis ? &ndot_24 : &ndot_18, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleSecondary(lv_obj_t *obj, const DisplayPalette &palette) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    lv_obj_set_style_text_color(obj, palette.textMuted, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_opa(obj, LV_OPA_80, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_letter_space(obj, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(obj, &ndot_18, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleMetricValue(lv_obj_t *obj, const DisplayPalette &palette, const lv_font_t *font = &lv_font_montserrat_24) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    lv_obj_set_style_text_color(obj, palette.textPrimary, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_opa(obj, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(obj, font, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleGlassButton(lv_obj_t *obj, const DisplayPalette &palette, const lv_color_t tone, const lv_coord_t radius,
                      const lv_coord_t borderWidth = 1, const lv_opa_t bgOpa = OPA_210) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    lv_obj_set_style_radius(obj, radius, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(obj, palette.surfaceStrong, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_color(obj, palette.surfaceElevated, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_NONE, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(obj, bgOpa, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(obj, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_opa(obj, LV_OPA_80, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(obj, borderWidth, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_color(obj, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_opa(obj, LV_OPA_0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_ofs_x(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_ofs_y(obj, 3, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleIconButton(lv_obj_t *obj, const DisplayPalette &palette, const lv_color_t tone) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    styleGlassButton(obj, palette, tone, 18);
    lv_obj_set_style_pad_left(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_right(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_top(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_bottom(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_img_recolor(obj, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_img_recolor_opa(obj, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_color(obj, palette.accent, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_opa(obj, LV_OPA_0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_ofs_y(obj, 3, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleMenuTile(lv_obj_t *obj, const DisplayPalette &palette, const lv_color_t tone) {
    if (obj == nullptr || !lv_obj_is_valid(obj))
        return;
    styleGlassButton(obj, palette, tone, 999, 1, OPA_200);
    lv_obj_set_style_bg_img_recolor(obj, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_img_recolor_opa(obj, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleScreenBase(lv_obj_t *screen, const DisplayPalette &palette, const bool roundDisplay) {
    if (screen == nullptr || !lv_obj_is_valid(screen))
        return;
    lv_obj_set_style_bg_color(screen, palette.surface, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_color(screen, palette.surface, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_dir(screen, LV_GRAD_DIR_NONE, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_main_stop(screen, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_stop(screen, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(screen, palette.surfaceOutline, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_opa(screen, roundDisplay ? LV_OPA_30 : LV_OPA_0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(screen, roundDisplay ? 2 : 0, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void setButtonLabel(lv_obj_t *button, lv_obj_t *label, const char *text, const lv_color_t tone) {
    if (button == nullptr || label == nullptr || !lv_obj_is_valid(button) || !lv_obj_is_valid(label))
        return;
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, tone, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(label, &ndot_18, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_letter_space(label, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(label, LV_OPA_0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_align(label, LV_ALIGN_BOTTOM_MID, 0, -12);
    lv_obj_move_foreground(label);
}

void styleDialRing(lv_obj_t *arc, const DisplayPalette &palette, const lv_color_t tone, const bool roundDisplay,
                   const bool ambient) {
    if (arc == nullptr || !lv_obj_is_valid(arc))
        return;
    lv_obj_set_style_arc_width(arc, roundDisplay ? 16 : 22, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_width(arc, roundDisplay ? 18 : 24, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(arc, true, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(arc, true, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_color(arc, ambient ? palette.surfaceOutline : palette.ringTrack, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_opa(arc, ambient ? LV_OPA_30 : LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_color(arc, tone, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_opa(arc, LV_OPA_COVER, LV_PART_INDICATOR | LV_STATE_DEFAULT);
}

void applyProcessRing(lv_obj_t *arc, const DisplayPalette &palette, const RingVisual &visual, const bool roundDisplay) {
    if (arc == nullptr || !lv_obj_is_valid(arc))
        return;
    styleDialRing(arc, palette, visual.tone, roundDisplay, false);
    lv_arc_set_mode(arc, LV_ARC_MODE_NORMAL);
    lv_arc_set_range(arc, 0, 100);
    lv_arc_set_bg_angles(arc, 210, 150);
    lv_arc_set_value(arc, visual.value);
}

String buildContextLine(const String &profile, const String &bean) {
    if (bean.isEmpty()) {
        return profile;
    }
    return profile + " • " + bean;
}
} // namespace

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
    pluginManager->on("controller:targetVolume:change", [=](Event const &event) {
        targetVolume = event.getFloat("value");
        rerender = true;
    });
    pluginManager->on("controller:targetDuration:change", [=](Event const &event) {
        targetDuration = event.getFloat("value");
        rerender = true;
    });
    pluginManager->on("controller:grindDuration:change", [=](Event const &event) {
        grindDuration = event.getInt("value");
        rerender = true;
    });
    pluginManager->on("controller:grindVolume:change", [=](Event const &event) {
        grindVolume = event.getFloat("value");
        rerender = true;
    });
    pluginManager->on("controller:process:end", triggerRender);
    pluginManager->on("controller:process:start", triggerRender);
    pluginManager->on("controller:mode:change", [this](Event const &event) {
        mode = event.getInt("value");
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
            changeScreen(&ui_SimpleProcessScreen, &ui_SimpleProcessScreen_screen_init);
            break;
        case MODE_WATER:
            changeScreen(&ui_SimpleProcessScreen, &ui_SimpleProcessScreen_screen_init);
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
    pluginManager->on("controller:bluetooth:waiting", [this](Event const &) {
        waitingForController = true;
        rerender = true;
    });
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        waitingForController = false;
        rerender = true;
        initialized = true;
        if (lv_scr_act() == ui_StandbyScreen) {
            Settings &settings = controller->getSettings();
            if (settings.getStartupMode() == MODE_BREW) {
                changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init);
            } else {
                standbyEnterTime = millis();
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
        updateActive = true;
        rerender = true;
        changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
    });
    pluginManager->on("ota:update:end", [this](Event const &) {
        updateActive = false;
        rerender = true;
        changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
    });
    pluginManager->on("ota:update:status", [this](Event const &event) {
        rerender = true;
        updateAvailable = event.getInt("value");
    });
    pluginManager->on("controller:error", [this](Event const &) {
        rerender = true;
        changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
    });
    pluginManager->on("controller:autotune:start",
                      [this](Event const &) { changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init); });
    pluginManager->on("controller:autotune:result",
                      [this](Event const &) { changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init); });

    pluginManager->on("profiles:profile:select", [this](Event const &event) {
        profileManager->loadSelectedProfile(selectedProfile);
        selectedProfileId = event.getString("id");
        targetDuration = profileManager->getSelectedProfile().getTotalDuration();
        targetVolume = profileManager->getSelectedProfile().getTotalVolume();
        profileVolumetric = profileManager->getSelectedProfile().isVolumetric();
        reloadProfiles();
        rerender = true;
    });
    pluginManager->on("profiles:profile:favorite", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:profile:unfavorite", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("profiles:profile:save", [this](Event const &event) { reloadProfiles(); });
    pluginManager->on("beans:selected", [this](Event const &event) {
        selectedBean = event.getString("name");
        rerender = true;
    });
    pluginManager->on("controller:volumetric-measurement:bluetooth:change", [=](Event const &event) {
        double newWeight = event.getFloat("value");
        if (round(newWeight * 10.0) != round(bluetoothWeight * 10.0)) {
            bluetoothWeight = newWeight;
            rerender = true;
        }
    });
    setupState();
    setupReactive();
    xTaskCreatePinnedToCore(loopTask, "DefaultUI::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 1);
    xTaskCreatePinnedToCore(profileLoopTask, "DefaultUI::loopProfiles", configMINIMAL_STACK_SIZE * 4, this, 1, &profileTaskHandle,
                            0);
}

void DefaultUI::loop() {
    const unsigned long now = millis();
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
        error = controller->isErrorState();
        autotuning = controller->isAutotuning();
        const Settings &settings = controller->getSettings();
        volumetricAvailable = controller->isVolumetricAvailable();
        bluetoothScales = controller->isBluetoothScaleHealthy();
        volumetricMode = volumetricAvailable && settings.isVolumetricTarget();
        brewVolumetric = volumetricAvailable && profileVolumetric;
        grindActive = controller->isGrindActive();
        active = controller->isActive();
        smartGrindActive = settings.isSmartGrindActive();
        grindAvailable = smartGrindActive || settings.getAltRelayFunction() == ALT_RELAY_GRIND;
        applyTheme();
        applyScreenVisualLanguage();
        if (controller->isErrorState()) {
            changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init);
        }
        updateTempStableFlag();
        handleScreenChange();
        currentScreen = lv_scr_act();
        applyScreenVisualLanguage();
        if (lv_scr_act() == ui_StandbyScreen)
            updateStandbyScreen();
        if (lv_scr_act() == ui_StatusScreen)
            updateStatusScreen();
        effect_mgr.evaluate_all();
    }

    lv_task_handler();
}

void DefaultUI::loopProfiles() {
    if (!profileLoaded) {
        favoritedProfileIds.clear();
        favoritedProfiles.clear();
        favoritedProfileIds.emplace_back(controller->getSettings().getSelectedProfile());
        for (auto &id : profileManager->getFavoritedProfiles()) {
            if (std::find(favoritedProfileIds.begin(), favoritedProfileIds.end(), id) == favoritedProfileIds.end())
                favoritedProfileIds.emplace_back(id);
        }
        for (const auto &profileId : favoritedProfileIds) {
            Profile profile{};
            profileManager->loadProfile(profileId, profile);
            favoritedProfiles.emplace_back(profile);
        }
        profileLoaded = 1;
    }
}

void DefaultUI::changeScreen(lv_obj_t **screen, void (*target_init)()) {
    targetScreen = screen;
    targetScreenInit = target_init;
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
    changeScreen(&ui_ProfileScreen, ui_ProfileScreen_screen_init);
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
    changeScreen(&ui_BrewScreen, ui_BrewScreen_screen_init);
}

void DefaultUI::onVolumetricDelete() {
    controller->onVolumetricDelete();
    profileVolumetric = profileManager->getSelectedProfile().isVolumetric();
    profileDirty = true;
}

void DefaultUI::setupPanel() {
    ui_init();
    lv_task_handler();

    delay(100);
    // Set initial brightness based on settings
    const Settings &settings = controller->getSettings();
    setBrightness(settings.getMainBrightness());
}

void DefaultUI::setupState() {
    error = controller->isErrorState();
    autotuning = controller->isAutotuning();
    const Settings &settings = controller->getSettings();
    volumetricAvailable = controller->isVolumetricAvailable();
    volumetricMode = volumetricAvailable && settings.isVolumetricTarget();
    grindActive = controller->isGrindActive();
    active = controller->isActive();
    smartGrindActive = settings.isSmartGrindActive();
    grindAvailable = smartGrindActive || settings.getAltRelayFunction() == ALT_RELAY_GRIND;
    mode = controller->getMode();
    currentTemp = static_cast<int>(controller->getCurrentTemp());
    targetTemp = static_cast<int>(controller->getTargetTemp());
    targetDuration = profileManager->getSelectedProfile().getTotalDuration();
    targetVolume = profileManager->getSelectedProfile().getTotalVolume();
    grindDuration = settings.getTargetGrindDuration();
    grindVolume = settings.getTargetGrindVolume();
    pressureAvailable = controller->getSystemInfo().capabilities.pressure ? 1 : 0;
    pressureScaling = std::ceil(settings.getPressureScaling());
    selectedProfileId = settings.getSelectedProfile();
    profileManager->loadSelectedProfile(selectedProfile);
    profileVolumetric = selectedProfile.isVolumetric();
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
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() { adjustDials(ui_SimpleProcessScreen_dials); }, &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; }, [=]() { adjustDials(ui_ProfileScreen_dials); },
                          &pressureAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; }, [=]() { adjustHeatingIndicator(ui_BrewScreen_dials); },
                          &isTemperatureStable, &heatingFlash);
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() { adjustHeatingIndicator(ui_SimpleProcessScreen_dials); }, &isTemperatureStable, &heatingFlash);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; }, [=]() { adjustHeatingIndicator(ui_MenuScreen_dials); },
                          &isTemperatureStable, &heatingFlash);
    effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; },
                          [=]() { adjustHeatingIndicator(ui_ProfileScreen_dials); }, &isTemperatureStable, &heatingFlash);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() { adjustHeatingIndicator(ui_GrindScreen_dials); }, &isTemperatureStable, &heatingFlash);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() { adjustHeatingIndicator(ui_StatusScreen_dials); }, &isTemperatureStable, &heatingFlash);
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() { lv_label_set_text(ui_SimpleProcessScreen_mainLabel5, mode == MODE_STEAM ? "STEAM" : "WATER"); },
                          &mode);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
                          [=]() {
                              lv_label_set_text_fmt(uic_MenuScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() {
                              lv_label_set_text_fmt(uic_StatusScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_label_set_text_fmt(uic_BrewScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              lv_label_set_text_fmt(uic_GrindScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() {
                              lv_label_set_text_fmt(uic_SimpleProcessScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; },
                          [=]() {
                              lv_label_set_text_fmt(uic_ProfileScreen_dials_tempText, "%d°C", currentTemp);
                          },
                          &currentTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; }, [=]() { adjustTempTarget(ui_MenuScreen_dials); },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_StatusScreen_targetTemp, "%d°C", targetTemp);
                              adjustTempTarget(ui_StatusScreen_dials);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_BrewScreen_targetTemp, "%d°C", targetTemp);
                              adjustTempTarget(ui_BrewScreen_dials);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; }, [=]() { adjustTempTarget(ui_GrindScreen_dials); },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() {
                              lv_label_set_text_fmt(ui_SimpleProcessScreen_targetTemp, "%d°C", targetTemp);
                              adjustTempTarget(ui_SimpleProcessScreen_dials);
                          },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; }, [=]() { adjustTempTarget(ui_ProfileScreen_dials); },
                          &targetTemp);
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
                          [=]() {
                              lv_arc_set_value(uic_MenuScreen_dials_pressureGauge, pressure * 10.0f);
                              lv_label_set_text_fmt(uic_MenuScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_StatusScreen; },
                          [=]() {
                              lv_arc_set_value(uic_StatusScreen_dials_pressureGauge, pressure * 10.0f);
                              lv_label_set_text_fmt(uic_StatusScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_arc_set_value(uic_BrewScreen_dials_pressureGauge, pressure * 10.0f);
                              lv_label_set_text_fmt(uic_BrewScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              lv_arc_set_value(uic_GrindScreen_dials_pressureGauge, pressure * 10.0f);
                              lv_label_set_text_fmt(uic_GrindScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() {
                              lv_arc_set_value(uic_SimpleProcessScreen_dials_pressureGauge, pressure * 10.0f);
                              lv_label_set_text_fmt(uic_SimpleProcessScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_ProfileScreen; },
                          [=]() {
                              lv_arc_set_value(uic_ProfileScreen_dials_pressureGauge, pressure * 10.0f);
                              lv_label_set_text_fmt(uic_ProfileScreen_dials_pressureText, "%.1f bar", pressure);
                          },
                          &pressure);
    effect_mgr.use_effect([=] { return currentScreen == ui_StandbyScreen; },
                          [=]() {
                              updateAvailable ? lv_obj_clear_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN)
                                              : lv_obj_add_flag(ui_StandbyScreen_updateIcon, LV_OBJ_FLAG_HIDDEN);
                          },
                          &updateAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_StandbyScreen; },
                          [=]() {
                              bool deactivated = true;
                              if (updateActive) {
                                  lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Updating...");
                              } else if (error) {
                                  if (controller->getError() == ERROR_CODE_RUNAWAY) {
                                      lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Temperature error, please restart");
                                  }
                              } else if (autotuning) {
                                  lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Autotuning...");
                              } else if (waitingForController) {
                                  lv_label_set_text_fmt(ui_StandbyScreen_mainLabel, "Waiting for controller...");
                              } else {
                                  deactivated = !initialized;
                              }
                              _ui_flag_modify(ui_StandbyScreen_mainLabel, LV_OBJ_FLAG_HIDDEN, deactivated);
                              _ui_flag_modify(ui_StandbyScreen_touchIcon, LV_OBJ_FLAG_HIDDEN, !deactivated);
                              _ui_flag_modify(ui_StandbyScreen_statusContainer, LV_OBJ_FLAG_HIDDEN, !deactivated);
                          },
                          &updateAvailable, &error, &autotuning, &waitingForController, &initialized);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              if (brewVolumetric) {
                                  lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%.1fg", targetVolume);
                              } else {
                                  const double secondsDouble = targetDuration;
                                  const auto minutes = static_cast<int>(secondsDouble / 60.0);
                                  const auto seconds = static_cast<int>(secondsDouble) % 60;
                                  lv_label_set_text_fmt(ui_BrewScreen_targetDuration, "%2d:%02d", minutes, seconds);
                              }
                          },
                          &targetDuration, &targetVolume, &brewVolumetric);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              if (volumetricMode) {
                                  lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%.1fg", grindVolume);
                              } else {
                                  const double secondsDouble = grindDuration / 1000.0;
                                  const auto minutes = static_cast<int>(secondsDouble / 60.0);
                                  const auto seconds = static_cast<int>(secondsDouble) % 60;
                                  lv_label_set_text_fmt(ui_GrindScreen_targetDuration, "%2d:%02d", minutes, seconds);
                              }
                          },
                          &grindDuration, &grindVolume, &volumetricMode);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              lv_img_set_src(ui_BrewScreen_Image4, brewVolumetric ? &ui_img_1424216268 : &ui_img_360122106);
                              _ui_flag_modify(ui_BrewScreen_byTimeButton, LV_OBJ_FLAG_HIDDEN, brewVolumetric);
                          },
                          &brewVolumetric);
    effect_mgr.use_effect(
        [=] { return currentScreen == ui_GrindScreen; },
        [=]() {
            lv_img_set_src(ui_GrindScreen_targetSymbol, volumetricMode ? &ui_img_1424216268 : &ui_img_360122106);
            ui_object_set_themeable_style_property(ui_GrindScreen_weightLabel, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_TEXT_COLOR,
                                                   volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
            ui_object_set_themeable_style_property(ui_GrindScreen_volumetricButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR,
                                                   volumetricMode ? _ui_theme_color_Dark : _ui_theme_color_NiceWhite);
            ui_object_set_themeable_style_property(ui_GrindScreen_modeSwitch, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                                   volumetricMode ? _ui_theme_color_NiceWhite : _ui_theme_color_Dark);
        },
        &volumetricMode);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() { _ui_flag_modify(ui_GrindScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN, volumetricAvailable); },
                          &volumetricAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_SimpleProcessScreen; },
                          [=]() {
                              if (mode == MODE_STEAM) {
                                  _ui_flag_modify(ui_SimpleProcessScreen_goButton, LV_OBJ_FLAG_HIDDEN, active);
                                  lv_imgbtn_set_src(ui_SimpleProcessScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                                                    &ui_img_691326438, nullptr);
                              } else {
                                  lv_imgbtn_set_src(ui_SimpleProcessScreen_goButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                                                    active ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
                              }
                          },
                          &active, &mode);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              lv_imgbtn_set_src(ui_GrindScreen_startButton, LV_IMGBTN_STATE_RELEASED, nullptr,
                                                grindActive ? &ui_img_1456692430 : &ui_img_445946954, nullptr);
                          },
                          &grindActive);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=] {
                              lv_label_set_text(ui_BrewScreen_profileName, selectedProfile.label.c_str());
                              lv_label_set_text(ui_BrewScreen_Label1,
                                                selectedBean.isEmpty() ? "PROFILE READY" : buildContextLine("Bean", selectedBean).c_str());
                          },
                          &selectedProfileId, &selectedBean);

    effect_mgr.use_effect(
        [=] { return currentScreen == ui_ProfileScreen; },
        [=] {
            if (profileLoaded) {
                _ui_flag_modify(ui_ProfileScreen_profileDetails, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_REMOVE);
                _ui_flag_modify(ui_ProfileScreen_loadingSpinner, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_ADD);
                lv_label_set_text(ui_ProfileScreen_profileName, favoritedProfiles[currentProfileIdx].label.c_str());
                lv_label_set_text(ui_ProfileScreen_mainLabel, currentProfileIdx == 0 ? "Current profile" : "Select profile");

                const auto minutes = static_cast<int>(favoritedProfiles[currentProfileIdx].getTotalDuration() / 60.0 - 0.5);
                const auto seconds = static_cast<int>(favoritedProfiles[currentProfileIdx].getTotalDuration()) % 60;
                lv_label_set_text_fmt(ui_ProfileScreen_targetDuration2, "%2d:%02d", minutes, seconds);
                lv_label_set_text_fmt(ui_ProfileScreen_targetTemp2, "%d°C",
                                      static_cast<int>(favoritedProfiles[currentProfileIdx].temperature));
                unsigned int phaseCount = favoritedProfiles[currentProfileIdx].getPhaseCount();
                unsigned int stepCount = favoritedProfiles[currentProfileIdx].phases.size();
                lv_label_set_text_fmt(ui_ProfileScreen_stepsLabel, "%d step%s", stepCount, stepCount > 1 ? "s" : "");
                lv_label_set_text_fmt(ui_ProfileScreen_phasesLabel, "%d phase%s", phaseCount, phaseCount > 1 ? "s" : "");
                ensureProfileBeanLabel();
                if (profileBeanLabel != nullptr) {
                    if (selectedBean.isEmpty()) {
                        lv_obj_add_flag(profileBeanLabel, LV_OBJ_FLAG_HIDDEN);
                    } else {
                        lv_obj_clear_flag(profileBeanLabel, LV_OBJ_FLAG_HIDDEN);
                        lv_label_set_text_fmt(profileBeanLabel, "Bean • %s", selectedBean.c_str());
                    }
                }
            } else {
                _ui_flag_modify(ui_ProfileScreen_profileDetails, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_ADD);
                _ui_flag_modify(ui_ProfileScreen_loadingSpinner, LV_OBJ_FLAG_HIDDEN, _UI_MODIFY_FLAG_REMOVE);
            }

            ui_object_set_themeable_style_property(ui_ProfileScreen_previousProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR,
                                                   currentProfileIdx > 0 ? _ui_theme_color_NiceWhite : _ui_theme_color_SemiDark);
            ui_object_set_themeable_style_property(ui_ProfileScreen_previousProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR_OPA,
                                                   currentProfileIdx > 0 ? _ui_theme_alpha_NiceWhite : _ui_theme_alpha_SemiDark);
            ui_object_set_themeable_style_property(
                ui_ProfileScreen_nextProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR,
                currentProfileIdx < favoritedProfiles.size() - 1 ? _ui_theme_color_NiceWhite : _ui_theme_color_SemiDark);
            ui_object_set_themeable_style_property(
                ui_ProfileScreen_nextProfileBtn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA,
                currentProfileIdx < favoritedProfiles.size() - 1 ? _ui_theme_alpha_NiceWhite : _ui_theme_alpha_SemiDark);
        },
        &selectedProfileId, &profileLoaded, &selectedBean);

    // Show/hide grind button based on SmartGrind setting or Alt Relay function
    effect_mgr.use_effect([=] { return currentScreen == ui_MenuScreen; },
                          [=]() {
                              grindAvailable ? lv_obj_clear_flag(ui_MenuScreen_grindBtn, LV_OBJ_FLAG_HIDDEN)
                                             : lv_obj_add_flag(ui_MenuScreen_grindBtn, LV_OBJ_FLAG_HIDDEN);
                          },
                          &grindAvailable);
    effect_mgr.use_effect([=] { return currentScreen == ui_BrewScreen; },
                          [=]() {
                              if (volumetricAvailable && bluetoothScales) {
                                  lv_label_set_text_fmt(ui_BrewScreen_weightLabel, "%.1fg", bluetoothWeight);
                              } else {
                                  lv_label_set_text(ui_BrewScreen_weightLabel, "-");
                              }
                          },
                          &bluetoothWeight, &volumetricAvailable, &bluetoothScales);
    effect_mgr.use_effect([=] { return currentScreen == ui_GrindScreen; },
                          [=]() {
                              if (volumetricAvailable && bluetoothScales) {
                                  lv_label_set_text_fmt(ui_GrindScreen_weightLabel, "%.1fg", bluetoothWeight);
                              } else {
                                  lv_label_set_text(ui_GrindScreen_weightLabel, "-");
                              }
                              ensureGrindBeanLabel();
                              if (grindBeanLabel != nullptr) {
                                  if (selectedBean.isEmpty()) {
                                      lv_obj_add_flag(grindBeanLabel, LV_OBJ_FLAG_HIDDEN);
                                  } else {
                                      lv_obj_clear_flag(grindBeanLabel, LV_OBJ_FLAG_HIDDEN);
                                      lv_label_set_text_fmt(grindBeanLabel, "Bean • %s", selectedBean.c_str());
                                  }
                              }
                          },
                          &bluetoothWeight, &volumetricAvailable, &bluetoothScales, &selectedBean);
    effect_mgr.use_effect(
        [=] { return currentScreen == ui_BrewScreen; },
        [=]() {
            _ui_flag_modify(ui_BrewScreen_adjustments, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
            _ui_flag_modify(ui_BrewScreen_acceptButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
            _ui_flag_modify(ui_BrewScreen_saveButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
            _ui_flag_modify(ui_BrewScreen_saveAsNewButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Settings);
            _ui_flag_modify(ui_BrewScreen_startButton, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Brew);
            _ui_flag_modify(ui_BrewScreen_profileInfo, LV_OBJ_FLAG_HIDDEN, brewScreenState == BrewScreenState::Brew);
            _ui_flag_modify(ui_BrewScreen_modeSwitch, LV_OBJ_FLAG_HIDDEN,
                            brewScreenState == BrewScreenState::Brew && volumetricAvailable);
            if (volumetricAvailable) {
                lv_img_set_src(ui_BrewScreen_volumetricButton, bluetoothScales ? &ui_img_1424216268 : &ui_img_flowmeter_png);
            }
        },
        &brewScreenState, &volumetricAvailable, &bluetoothScales);
    effect_mgr.use_effect(
        [=] { return currentScreen == ui_BrewScreen; },
        [=]() {
            ui_object_set_themeable_style_property(ui_BrewScreen_saveButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR,
                                                   profileDirty ? _ui_theme_color_NiceWhite : _ui_theme_color_SemiDark);
            ui_object_set_themeable_style_property(ui_BrewScreen_saveButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR_OPA,
                                                   profileDirty ? _ui_theme_alpha_NiceWhite : _ui_theme_alpha_SemiDark);
            ui_object_set_themeable_style_property(ui_BrewScreen_saveAsNewButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR,
                                                   profileDirty ? _ui_theme_color_NiceWhite : _ui_theme_color_SemiDark);
            ui_object_set_themeable_style_property(ui_BrewScreen_saveAsNewButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                                   LV_STYLE_IMG_RECOLOR_OPA,
                                                   profileDirty ? _ui_theme_alpha_NiceWhite : _ui_theme_alpha_SemiDark);
        },
        &brewScreenState, &profileDirty);
    effect_mgr.use_effect([=] { return currentScreen == ui_StandbyScreen; },
                          [=]() { lv_img_set_src(ui_StandbyScreen_logo, christmasMode ? &ui_img_1510335 : &ui_img_logo_png); },
                          &christmasMode);
}

void DefaultUI::handleScreenChange() {
    lv_obj_t *current = lv_scr_act();

    if (current != *targetScreen) {
        if (*targetScreen == ui_StandbyScreen) {
            standbyEnterTime = millis();
        } else if (current == ui_StandbyScreen) {
            const Settings &settings = controller->getSettings();
            setBrightness(settings.getMainBrightness());
        }

        _ui_screen_change(targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0, targetScreenInit);
        resetCustomScreenHandles();
        lv_obj_del(current);
        rerender = true;
    }
}

void DefaultUI::resetCustomScreenHandles() {
    standbyContextLabel = nullptr;
    statusBeanLabel = nullptr;
    profileBeanLabel = nullptr;
    grindBeanLabel = nullptr;
    menuBrewLabel = nullptr;
    menuSteamLabel = nullptr;
    menuWaterLabel = nullptr;
    menuGrindLabel = nullptr;
    brewContextLabel = nullptr;
}

bool DefaultUI::isRoundDisplay() const {
    lv_disp_t *display = lv_disp_get_default();
    if (display == nullptr) {
        return false;
    }
    const lv_coord_t width = lv_disp_get_hor_res(display);
    const lv_coord_t height = lv_disp_get_ver_res(display);
    return width == height && width >= 400;
}

void DefaultUI::ensureStandbyContextLabel() {
    if (lv_scr_act() != ui_StandbyScreen || !lv_obj_is_valid(ui_StandbyScreen) || standbyContextLabel != nullptr) {
        return;
    }

    standbyContextLabel = lv_label_create(ui_StandbyScreen);
    lv_obj_set_width(standbyContextLabel, 360);
    lv_label_set_long_mode(standbyContextLabel, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_align(standbyContextLabel, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_align(standbyContextLabel, LV_ALIGN_BOTTOM_MID, 0, -32);
}

void DefaultUI::ensureStatusBeanLabel() {
    if (lv_scr_act() != ui_StatusScreen || !lv_obj_is_valid(ui_StatusScreen_contentPanel2) || statusBeanLabel != nullptr) {
        return;
    }

    statusBeanLabel = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(statusBeanLabel, 240);
    lv_obj_align_to(statusBeanLabel, ui_StatusScreen_phaseLabel, LV_ALIGN_OUT_BOTTOM_MID, 0, 12);
    lv_label_set_long_mode(statusBeanLabel, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_align(statusBeanLabel, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void DefaultUI::ensureProfileBeanLabel() {
    if (lv_scr_act() != ui_ProfileScreen || !lv_obj_is_valid(ui_ProfileScreen_contentPanel) || profileBeanLabel != nullptr) {
        return;
    }

    profileBeanLabel = lv_label_create(ui_ProfileScreen_contentPanel);
    lv_obj_set_width(profileBeanLabel, 240);
    lv_obj_align_to(profileBeanLabel, ui_ProfileScreen_profileName, LV_ALIGN_OUT_BOTTOM_MID, 0, 10);
    lv_label_set_long_mode(profileBeanLabel, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_align(profileBeanLabel, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void DefaultUI::ensureGrindBeanLabel() {
    if (lv_scr_act() != ui_GrindScreen || !lv_obj_is_valid(ui_GrindScreen_contentPanel7) || grindBeanLabel != nullptr) {
        return;
    }

    grindBeanLabel = lv_label_create(ui_GrindScreen_contentPanel7);
    lv_obj_set_width(grindBeanLabel, 220);
    lv_obj_align_to(grindBeanLabel, ui_GrindScreen_mainLabel7, LV_ALIGN_OUT_BOTTOM_MID, 0, 10);
    lv_label_set_long_mode(grindBeanLabel, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_align(grindBeanLabel, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void DefaultUI::ensureMenuActionLabels() {
    if (lv_scr_act() != ui_MenuScreen || !lv_obj_is_valid(ui_MenuScreen_contentPanel1)) {
        return;
    }

    if (menuBrewLabel == nullptr && lv_obj_is_valid(ui_MenuScreen_btnBrew)) {
        menuBrewLabel = lv_label_create(ui_MenuScreen_btnBrew);
    }
    if (menuSteamLabel == nullptr && lv_obj_is_valid(ui_MenuScreen_btnSteam)) {
        menuSteamLabel = lv_label_create(ui_MenuScreen_btnSteam);
    }
    if (menuWaterLabel == nullptr && lv_obj_is_valid(ui_MenuScreen_waterBtn)) {
        menuWaterLabel = lv_label_create(ui_MenuScreen_waterBtn);
    }
    if (menuGrindLabel == nullptr && lv_obj_is_valid(ui_MenuScreen_grindBtn)) {
        menuGrindLabel = lv_label_create(ui_MenuScreen_grindBtn);
    }
}

void DefaultUI::ensureBrewContextLabel() {
    if (lv_scr_act() != ui_BrewScreen || !lv_obj_is_valid(ui_BrewScreen_profileInfo) || brewContextLabel != nullptr) {
        return;
    }

    brewContextLabel = lv_label_create(ui_BrewScreen_profileInfo);
    lv_obj_set_width(brewContextLabel, 240);
    lv_label_set_long_mode(brewContextLabel, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_align(brewContextLabel, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void DefaultUI::applyScreenVisualLanguage() {
    const bool amoledPanel = AmoledDisplayDriver::getInstance() == panelDriver;
    const int resolvedThemeMode = resolveDisplayThemeMode(controller->getSettings().getThemeMode(), amoledPanel);
    const DisplayPalette palette = makeDisplayPalette(resolvedThemeMode, amoledPanel);
    lv_obj_t *activeScreen = lv_scr_act();
    const bool roundDisplay = isRoundDisplay();
    const RingVisual ringVisual =
        buildRingVisual(palette, mode, currentTemp, targetTemp, active, grindActive, controller);

    styleScreenBase(activeScreen, palette, roundDisplay);

    if (activeScreen == ui_BrewScreen) {
        ensureBrewContextLabel();
        stylePanel(ui_BrewScreen_contentPanel4, palette, roundDisplay ? OPA_45 : OPA_55, roundDisplay ? 180 : 44);
        stylePanel(ui_BrewScreen_profileInfo, palette, OPA_200, 28);
        stylePanel(ui_BrewScreen_modeSwitch, palette, OPA_220, 22);
        stylePanel(ui_BrewScreen_tempContainer, palette, OPA_210, 22);
        stylePanel(ui_BrewScreen_targetContainer, palette, OPA_210, 22);
        styleHeadline(ui_BrewScreen_mainLabel3, palette, true);
        styleSecondary(ui_BrewScreen_Label1, palette);
        styleHeadline(ui_BrewScreen_profileName, palette, true);
        applyProcessRing(uic_BrewScreen_dials_tempGauge, palette, ringVisual, roundDisplay);
        styleMetricValue(ui_BrewScreen_profileName, palette, &ndot_24);
        styleMetricValue(ui_BrewScreen_weightLabel, palette, &ndot_24);
        styleMetricValue(ui_BrewScreen_targetTemp, palette, &ndot_24);
        styleMetricValue(ui_BrewScreen_targetDuration, palette, &ndot_24);
        styleIconButton(ui_BrewScreen_ImgButton5, palette, palette.textPrimary);
        styleIconButton(ui_BrewScreen_startButton, palette, palette.accent);
        styleIconButton(ui_BrewScreen_profileSelectBtn, palette, palette.accent);
        styleIconButton(ui_BrewScreen_settingsButton, palette, palette.textMuted);
        styleIconButton(ui_BrewScreen_downTempButton, palette, palette.textMuted);
        styleIconButton(ui_BrewScreen_upTempButton, palette, palette.accent);
        styleIconButton(ui_BrewScreen_downDurationButton, palette, palette.textMuted);
        styleIconButton(ui_BrewScreen_upDurationButton, palette, palette.accent);
        styleIconButton(ui_BrewScreen_saveButton, palette, palette.textMuted);
        styleIconButton(ui_BrewScreen_acceptButton, palette, palette.success);
        styleIconButton(ui_BrewScreen_saveAsNewButton, palette, palette.warning);
        if (lv_obj_is_valid(ui_BrewScreen_Image5)) {
            lv_obj_set_style_img_recolor(ui_BrewScreen_Image5, palette.warning, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(ui_BrewScreen_Image5, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (lv_obj_is_valid(ui_BrewScreen_Image4)) {
            lv_obj_set_style_img_recolor(ui_BrewScreen_Image4, palette.accent, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(ui_BrewScreen_Image4, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (lv_obj_is_valid(ui_BrewScreen_mainLabel3)) {
            lv_label_set_text(ui_BrewScreen_mainLabel3, ringVisual.title);
            lv_obj_set_style_text_color(ui_BrewScreen_mainLabel3, ringVisual.tone, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(ui_BrewScreen_mainLabel3, &ndot_24, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (brewContextLabel != nullptr && lv_obj_is_valid(brewContextLabel)) {
            const String brewContext = selectedBean.isEmpty() ? "Ready to brew" : String("Bean | ") + selectedBean;
            lv_label_set_text(brewContextLabel, brewContext.c_str());
            styleSecondary(brewContextLabel, palette);
        }
        if (roundDisplay) {
            lv_obj_set_size(ui_BrewScreen_contentPanel4, 372, 372);
            lv_obj_align(ui_BrewScreen_contentPanel4, LV_ALIGN_CENTER, 0, 4);
            lv_obj_set_size(ui_BrewScreen_profileInfo, 276, 98);
            lv_obj_align(ui_BrewScreen_profileInfo, LV_ALIGN_TOP_MID, 0, 102);
            lv_obj_set_size(ui_BrewScreen_modeSwitch, 180, 52);
            lv_obj_align(ui_BrewScreen_modeSwitch, LV_ALIGN_TOP_MID, 0, 64);
            lv_obj_align(ui_BrewScreen_mainLabel3, LV_ALIGN_TOP_MID, 0, 34);
            lv_obj_align(ui_BrewScreen_startButton, LV_ALIGN_BOTTOM_MID, 0, -18);
            lv_obj_set_size(ui_BrewScreen_startButton, 74, 74);
            styleGlassButton(ui_BrewScreen_startButton, palette, palette.accent, 999, 2, OPA_200);
            lv_obj_align(ui_BrewScreen_controlContainer, LV_ALIGN_CENTER, 0, 8);
            lv_obj_set_size(ui_BrewScreen_controlContainer, 300, 190);
            lv_obj_set_style_pad_row(ui_BrewScreen_controlContainer, 14, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_size(ui_BrewScreen_tempContainer, 132, 62);
            lv_obj_set_size(ui_BrewScreen_targetContainer, 132, 62);
            lv_obj_set_style_pad_all(ui_BrewScreen_tempContainer, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_all(ui_BrewScreen_targetContainer, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_row(ui_BrewScreen_adjustments, 12, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_column(ui_BrewScreen_adjustments, 12, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_align(ui_BrewScreen_ImgButton5, LV_ALIGN_TOP_LEFT, 28, 28);
            lv_obj_set_size(ui_BrewScreen_ImgButton5, 52, 52);
            lv_obj_align(ui_BrewScreen_profileSelectBtn, LV_ALIGN_LEFT_MID, 18, 0);
            lv_obj_align(ui_BrewScreen_settingsButton, LV_ALIGN_RIGHT_MID, -18, 0);
            if (brewContextLabel != nullptr) {
                lv_obj_align_to(brewContextLabel, ui_BrewScreen_profileName, LV_ALIGN_OUT_BOTTOM_MID, 0, 8);
            }
        }
    } else if (activeScreen == ui_StatusScreen) {
        stylePanel(ui_StatusScreen_contentPanel2, palette, roundDisplay ? OPA_45 : OPA_55, roundDisplay ? 180 : 44);
        styleHeadline(ui_StatusScreen_phaseLabel, palette, true);
        styleChip(ui_StatusScreen_stepLabel, palette, active ? palette.success : palette.warning, true);
        styleHeadline(ui_StatusScreen_currentDuration, palette, true);
        styleSecondary(ui_StatusScreen_targetDuration, palette);
        styleSecondary(ui_StatusScreen_brewLabel, palette);
        styleSecondary(ui_StatusScreen_targetTemp, palette);
        applyProcessRing(uic_StatusScreen_dials_tempGauge, palette, ringVisual, roundDisplay);
        styleMetricValue(ui_StatusScreen_currentDuration, palette, &ndot_34);
        styleMetricValue(ui_StatusScreen_brewVolume, palette, &ndot_24);
        styleIconButton(ui_StatusScreen_ImgButton8, palette, palette.textPrimary);
        styleIconButton(ui_StatusScreen_pauseButton, palette, active ? palette.danger : palette.success);
        if (lv_obj_is_valid(ui_StatusScreen_barContainer)) {
            stylePanel(ui_StatusScreen_barContainer, palette, OPA_200, 999);
            lv_obj_set_style_pad_left(ui_StatusScreen_barContainer, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(ui_StatusScreen_barContainer, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(ui_StatusScreen_barContainer, 6, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(ui_StatusScreen_barContainer, 6, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (lv_obj_is_valid(ui_StatusScreen_brewBar)) {
            lv_obj_set_style_radius(ui_StatusScreen_brewBar, 999, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(ui_StatusScreen_brewBar, 999, LV_PART_INDICATOR | LV_STATE_DEFAULT);
        }
        ensureStatusBeanLabel();
        if (statusBeanLabel != nullptr && lv_obj_is_valid(statusBeanLabel)) {
            styleChip(statusBeanLabel, palette, palette.accent, true);
        }
        if (roundDisplay) {
            lv_obj_set_size(ui_StatusScreen_contentPanel2, 372, 372);
            lv_obj_align(ui_StatusScreen_contentPanel2, LV_ALIGN_CENTER, 0, 4);
            lv_obj_align(ui_StatusScreen_ImgButton8, LV_ALIGN_TOP_LEFT, 28, 28);
            lv_obj_set_size(ui_StatusScreen_ImgButton8, 52, 52);
            lv_obj_align(ui_StatusScreen_targetTemp, LV_ALIGN_TOP_MID, -56, 38);
            lv_obj_align(ui_StatusScreen_targetDuration, LV_ALIGN_TOP_MID, 62, 38);
            lv_obj_align(ui_StatusScreen_stepLabel, LV_ALIGN_TOP_MID, 0, 84);
            lv_obj_align(ui_StatusScreen_phaseLabel, LV_ALIGN_TOP_MID, 0, 124);
            if (statusBeanLabel != nullptr) {
                lv_obj_align_to(statusBeanLabel, ui_StatusScreen_phaseLabel, LV_ALIGN_OUT_BOTTOM_MID, 0, 10);
            }
            lv_obj_align(ui_StatusScreen_currentDuration, LV_ALIGN_CENTER, 0, 42);
            lv_obj_set_style_text_font(ui_StatusScreen_currentDuration, &ndot_34, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_align(ui_StatusScreen_barContainer, LV_ALIGN_BOTTOM_MID, 0, -72);
            lv_obj_set_size(ui_StatusScreen_barContainer, 240, 22);
            lv_obj_align(ui_StatusScreen_labelContainer, LV_ALIGN_BOTTOM_MID, 0, -42);
            lv_obj_set_size(ui_StatusScreen_labelContainer, 240, 18);
            lv_obj_align(ui_StatusScreen_brewVolume, LV_ALIGN_BOTTOM_MID, 0, -104);
            lv_obj_align(ui_StatusScreen_pauseButton, LV_ALIGN_BOTTOM_MID, 0, -18);
            lv_obj_set_size(ui_StatusScreen_pauseButton, 72, 72);
            styleGlassButton(ui_StatusScreen_pauseButton, palette, active ? palette.danger : palette.success, 999, 2, OPA_200);
        }
    } else if (activeScreen == ui_ProfileScreen) {
        stylePanel(ui_ProfileScreen_contentPanel, palette, OPA_55, 44);
        styleHeadline(ui_ProfileScreen_mainLabel, palette, false);
        styleHeadline(ui_ProfileScreen_profileName, palette, true);
        styleSecondary(ui_ProfileScreen_phasesLabel, palette);
        styleSecondary(ui_ProfileScreen_stepsLabel, palette);
        styleIconButton(ui_ProfileScreen_ImgButton1, palette, palette.textPrimary);
        styleIconButton(ui_ProfileScreen_previousProfileBtn, palette, palette.textMuted);
        styleIconButton(ui_ProfileScreen_nextProfileBtn, palette, palette.accent);
        styleIconButton(ui_ProfileScreen_chooseButton, palette, palette.success);
        applyProcessRing(uic_ProfileScreen_dials_tempGauge, palette, ringVisual, roundDisplay);
        styleMetricValue(ui_ProfileScreen_profileName, palette, &ndot_24);
        styleMetricValue(ui_ProfileScreen_targetTemp2, palette, &ndot_24);
        styleMetricValue(ui_ProfileScreen_targetDuration2, palette, &ndot_24);
        if (lv_obj_is_valid(ui_ProfileScreen_Chart1)) {
            stylePanel(ui_ProfileScreen_Chart1, palette, OPA_190, 20);
        }
        ensureProfileBeanLabel();
        if (profileBeanLabel != nullptr && lv_obj_is_valid(profileBeanLabel)) {
            styleChip(profileBeanLabel, palette, palette.accent, true);
        }
        if (lv_obj_is_valid(ui_ProfileScreen_mainLabel)) {
            lv_label_set_text(ui_ProfileScreen_mainLabel, "Profile Preview");
            lv_obj_set_style_text_font(ui_ProfileScreen_mainLabel, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    } else if (activeScreen == ui_GrindScreen) {
        stylePanel(ui_GrindScreen_contentPanel7, palette, OPA_55, 44);
        styleHeadline(ui_GrindScreen_mainLabel7, palette, true);
        styleSecondary(ui_GrindScreen_targetDuration, palette);
        applyProcessRing(uic_GrindScreen_dials_tempGauge, palette, ringVisual, roundDisplay);
        styleMetricValue(ui_GrindScreen_targetDuration, palette, &ndot_24);
        styleIconButton(ui_GrindScreen_ImgButton2, palette, palette.textPrimary);
        styleIconButton(ui_GrindScreen_startButton, palette, palette.accent);
        styleIconButton(ui_GrindScreen_downDurationButton, palette, palette.textMuted);
        styleIconButton(ui_GrindScreen_upDurationButton, palette, palette.accent);
        ensureGrindBeanLabel();
        if (grindBeanLabel != nullptr && lv_obj_is_valid(grindBeanLabel)) {
            styleChip(grindBeanLabel, palette, palette.accent, true);
        }
        if (lv_obj_is_valid(ui_GrindScreen_mainLabel7)) {
            lv_label_set_text(ui_GrindScreen_mainLabel7, grindActive ? "GRINDING" : "GRIND");
            lv_obj_set_style_text_font(ui_GrindScreen_mainLabel7, &ndot_24, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(ui_GrindScreen_mainLabel7, palette.grind, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    } else if (activeScreen == ui_MenuScreen) {
        ensureMenuActionLabels();
        stylePanel(ui_MenuScreen_contentPanel1, palette, roundDisplay ? OPA_45 : OPA_55, roundDisplay ? 180 : 44);
        styleIconButton(ui_MenuScreen_standbyButton, palette, palette.textPrimary);
        styleMenuTile(ui_MenuScreen_btnBrew, palette, palette.accent);
        styleMenuTile(ui_MenuScreen_btnSteam, palette, palette.accentCool);
        styleMenuTile(ui_MenuScreen_waterBtn, palette, palette.water);
        styleMenuTile(ui_MenuScreen_grindBtn, palette, palette.grind);
        if (menuBrewLabel != nullptr) {
            setButtonLabel(ui_MenuScreen_btnBrew, menuBrewLabel, "BREW", palette.accent);
        }
        if (menuSteamLabel != nullptr) {
            setButtonLabel(ui_MenuScreen_btnSteam, menuSteamLabel, "STEAM", palette.accentCool);
        }
        if (menuWaterLabel != nullptr) {
            setButtonLabel(ui_MenuScreen_waterBtn, menuWaterLabel, "WATER", palette.water);
        }
        if (menuGrindLabel != nullptr) {
            setButtonLabel(ui_MenuScreen_grindBtn, menuGrindLabel, "GRIND", palette.grind);
        }
        if (roundDisplay) {
            lv_obj_set_size(ui_MenuScreen_contentPanel1, 366, 366);
            lv_obj_set_style_pad_all(ui_MenuScreen_contentPanel1, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_row(ui_MenuScreen_contentPanel1, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_column(ui_MenuScreen_contentPanel1, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_align(ui_MenuScreen_contentPanel1, LV_ALIGN_CENTER, 0, 2);
            lv_obj_set_size(ui_MenuScreen_btnBrew, 118, 118);
            lv_obj_set_size(ui_MenuScreen_btnSteam, 118, 118);
            lv_obj_set_size(ui_MenuScreen_waterBtn, 112, 112);
            lv_obj_set_size(ui_MenuScreen_grindBtn, 112, 112);
            lv_obj_align(ui_MenuScreen_btnBrew, LV_ALIGN_LEFT_MID, 18, 18);
            lv_obj_align(ui_MenuScreen_btnSteam, LV_ALIGN_CENTER, 0, 26);
            lv_obj_align(ui_MenuScreen_waterBtn, LV_ALIGN_RIGHT_MID, -18, 18);
            lv_obj_align(ui_MenuScreen_grindBtn, LV_ALIGN_BOTTOM_MID, 0, -18);
            lv_obj_align(ui_MenuScreen_standbyButton, LV_ALIGN_BOTTOM_MID, 0, -22);
            lv_obj_set_size(ui_MenuScreen_standbyButton, 84, 84);
            styleGlassButton(ui_MenuScreen_standbyButton, palette, palette.textPrimary, 999, 2, OPA_200);
            lv_obj_move_foreground(ui_MenuScreen_standbyButton);
        }
    } else if (activeScreen == ui_SimpleProcessScreen) {
        stylePanel(ui_SimpleProcessScreen_contentPanel5, palette, roundDisplay ? OPA_45 : OPA_55, roundDisplay ? 180 : 44);
        styleHeadline(ui_SimpleProcessScreen_mainLabel5, palette, true);
        applyProcessRing(uic_SimpleProcessScreen_dials_tempGauge, palette, ringVisual, roundDisplay);
        styleMetricValue(ui_SimpleProcessScreen_targetTemp, palette, roundDisplay ? &ndot_34 : &ndot_24);
        styleIconButton(ui_SimpleProcessScreen_ImgButton6, palette, palette.textPrimary);
        styleIconButton(ui_SimpleProcessScreen_downTempButton, palette, palette.textMuted);
        styleIconButton(ui_SimpleProcessScreen_upTempButton, palette, palette.accent);
        styleIconButton(ui_SimpleProcessScreen_goButton, palette, mode == MODE_STEAM ? palette.accentCool : palette.water);
        if (lv_obj_is_valid(ui_SimpleProcessScreen_Image9)) {
            lv_obj_set_style_img_recolor(ui_SimpleProcessScreen_Image9, mode == MODE_STEAM ? palette.accentCool : palette.water,
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(ui_SimpleProcessScreen_Image9, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (lv_obj_is_valid(ui_SimpleProcessScreen_mainLabel5)) {
            lv_label_set_text(ui_SimpleProcessScreen_mainLabel5, ringVisual.title);
            lv_obj_set_style_text_color(ui_SimpleProcessScreen_mainLabel5, ringVisual.tone, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(ui_SimpleProcessScreen_mainLabel5, &ndot_24, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (roundDisplay) {
            lv_obj_set_size(ui_SimpleProcessScreen_contentPanel5, 372, 372);
            lv_obj_align(ui_SimpleProcessScreen_contentPanel5, LV_ALIGN_CENTER, 0, 4);
            lv_obj_align(ui_SimpleProcessScreen_ImgButton6, LV_ALIGN_TOP_LEFT, 28, 28);
            lv_obj_set_size(ui_SimpleProcessScreen_ImgButton6, 52, 52);
            lv_obj_align(ui_SimpleProcessScreen_mainLabel5, LV_ALIGN_TOP_MID, 0, 40);
            lv_obj_align(ui_SimpleProcessScreen_Image9, LV_ALIGN_TOP_MID, 0, 90);
            lv_obj_align(ui_SimpleProcessScreen_targetTemp, LV_ALIGN_CENTER, 0, 20);
            lv_obj_align(ui_SimpleProcessScreen_downTempButton, LV_ALIGN_CENTER, -92, 18);
            lv_obj_align(ui_SimpleProcessScreen_upTempButton, LV_ALIGN_CENTER, 92, 18);
            lv_obj_align(ui_SimpleProcessScreen_goButton, LV_ALIGN_BOTTOM_MID, 0, -18);
            lv_obj_set_size(ui_SimpleProcessScreen_goButton, 72, 72);
            styleGlassButton(ui_SimpleProcessScreen_goButton, palette, mode == MODE_STEAM ? palette.accentCool : palette.water,
                             999, 2, OPA_200);
        }
    } else if (activeScreen == ui_StandbyScreen) {
        ensureStandbyContextLabel();
        if (lv_obj_is_valid(ui_StandbyScreen_time)) {
            styleMetricValue(ui_StandbyScreen_time, palette, &ndot_34);
            lv_obj_set_style_text_letter_space(ui_StandbyScreen_time, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (lv_obj_is_valid(ui_StandbyScreen_statusContainer)) {
            stylePanel(ui_StandbyScreen_statusContainer, palette, OPA_185, 999);
            lv_obj_set_style_pad_left(ui_StandbyScreen_statusContainer, 14, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(ui_StandbyScreen_statusContainer, 14, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(ui_StandbyScreen_statusContainer, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(ui_StandbyScreen_statusContainer, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_column(ui_StandbyScreen_statusContainer, 18, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (standbyContextLabel != nullptr && lv_obj_is_valid(standbyContextLabel)) {
            styleChip(standbyContextLabel, palette, palette.accent, true);
        }
        if (lv_obj_is_valid(ui_StandbyScreen_logo)) {
            lv_obj_set_style_img_recolor(ui_StandbyScreen_logo, palette.textPrimary, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(ui_StandbyScreen_logo, LV_OPA_90, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (lv_obj_is_valid(ui_StandbyScreen_mainLabel)) {
            lv_label_set_text(ui_StandbyScreen_mainLabel, "Touch to wake");
            styleSecondary(ui_StandbyScreen_mainLabel, palette);
            lv_obj_set_style_text_font(ui_StandbyScreen_mainLabel, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (roundDisplay) {
            lv_obj_align(ui_StandbyScreen_statusContainer, LV_ALIGN_TOP_MID, 0, 24);
            lv_obj_set_size(ui_StandbyScreen_statusContainer, 180, 36);
            lv_obj_align(ui_StandbyScreen_time, LV_ALIGN_TOP_MID, 0, 84);
            lv_img_set_zoom(ui_StandbyScreen_logo, 150);
            lv_obj_align(ui_StandbyScreen_logo, LV_ALIGN_CENTER, 0, -8);
            lv_obj_align(ui_StandbyScreen_mainLabel, LV_ALIGN_BOTTOM_MID, 0, -52);
            if (standbyContextLabel != nullptr) {
                lv_obj_align(standbyContextLabel, LV_ALIGN_BOTTOM_MID, 0, -92);
            }
        }
    }
}

void DefaultUI::updateStandbyScreen() {
    ensureStandbyContextLabel();
    if (standbyEnterTime > 0) {
        const Settings &settings = controller->getSettings();
        const unsigned long now = millis();
        if (now - standbyEnterTime >= settings.getStandbyBrightnessTimeout()) {
            setBrightness(settings.getStandbyBrightness());
        }
    }

    if (!apActive && WiFi.status() == WL_CONNECTED && !updateActive && !error && !autotuning && !waitingForController &&
        initialized) {
        time_t now;
        struct tm timeinfo;

        localtime_r(&now, &timeinfo);
        // allocate enough space for both 12h/24h time formats
        if (getLocalTime(&timeinfo, 500)) {
            char time[9];
            Settings &settings = controller->getSettings();
            const char *format = settings.isClock24hFormat() ? "%H:%M" : "%I:%M %p";
            strftime(time, sizeof(time), format, &timeinfo);
            lv_label_set_text(ui_StandbyScreen_time, time);
            lv_obj_clear_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);

            christmasMode = (timeinfo.tm_mon == 11 && timeinfo.tm_mday < 27) || (timeinfo.tm_mon == 0 && timeinfo.tm_mday < 6);
        }
    } else {
        lv_obj_add_flag(ui_StandbyScreen_time, LV_OBJ_FLAG_HIDDEN);
    }
    controller->getClientController()->isConnected() ? lv_obj_clear_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN)
                                                     : lv_obj_add_flag(ui_StandbyScreen_bluetoothIcon, LV_OBJ_FLAG_HIDDEN);
    !apActive &&WiFi.status() == WL_CONNECTED ? lv_obj_clear_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN)
                                              : lv_obj_add_flag(ui_StandbyScreen_wifiIcon, LV_OBJ_FLAG_HIDDEN);

    if (standbyContextLabel != nullptr) {
        const String standbyContext = buildContextLine(selectedProfile.label.isEmpty() ? "Ready" : selectedProfile.label, selectedBean);
        lv_label_set_text(standbyContextLabel, standbyContext.c_str());
        if (selectedProfile.label.isEmpty() && selectedBean.isEmpty()) {
            lv_obj_add_flag(standbyContextLabel, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_clear_flag(standbyContextLabel, LV_OBJ_FLAG_HIDDEN);
        }
    }
}

void DefaultUI::updateStatusScreen() const {
    const_cast<DefaultUI *>(this)->ensureStatusBeanLabel();
    
    // Use thread-safe snapshot to avoid use-after-free race conditions
    ProcessSnapshot proc = controller->getProcessSnapshot();
    
    if (!proc.exists || !proc.isBrew) {
        return;
    }

    // Validate phase index
    if (proc.phaseIndex >= proc.phaseCount) {
        ESP_LOGE("DefaultUI", "Process phaseIndex out of bounds: %u >= %zu", proc.phaseIndex, proc.phaseCount);
        return;
    }

    unsigned long now = millis();
    if (!proc.isActive && proc.finished > 0) {
        now = proc.finished;
    }

    lv_label_set_text(ui_StatusScreen_stepLabel, proc.phaseType == static_cast<int>(PhaseType::PHASE_TYPE_BREW) ? "BREW" : "INFUSION");
    String phaseText = "Finished";
    if (proc.isActive) {
        phaseText = proc.phaseName;
    } else if (controller->getSettings().isDelayAdjust() && !proc.isComplete) {
        phaseText = "Calibrating...";
    }
    lv_label_set_text(ui_StatusScreen_phaseLabel, phaseText.c_str());
    if (statusBeanLabel != nullptr) {
        if (selectedBean.isEmpty()) {
            lv_obj_add_flag(statusBeanLabel, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_clear_flag(statusBeanLabel, LV_OBJ_FLAG_HIDDEN);
            lv_label_set_text_fmt(statusBeanLabel, "Bean • %s", selectedBean.c_str());
        }
    }

    // Add bounds check for processStarted timestamp
    if (proc.started > 0 && now >= proc.started) {
        const unsigned long processDuration = now - proc.started;
        const double processSecondsDouble = processDuration / 1000.0;
        const auto processMinutes = static_cast<int>(processSecondsDouble / 60.0);
        const auto processSeconds = static_cast<int>(processSecondsDouble) % 60;
        lv_label_set_text_fmt(ui_StatusScreen_currentDuration, "%2d:%02d", processMinutes, processSeconds);
    } else {
        lv_label_set_text_fmt(ui_StatusScreen_currentDuration, "00:00");
    }

    if (proc.target == ProcessTarget::VOLUMETRIC && proc.hasVolumetricTarget) {
        lv_bar_set_value(ui_StatusScreen_brewBar, proc.currentVolume * 10.0, LV_ANIM_OFF);
        lv_bar_set_range(ui_StatusScreen_brewBar, 0, proc.volumetricTargetValue * 10.0 + 1.0);
        lv_label_set_text_fmt(ui_StatusScreen_brewLabel, "%.1f / %.1fg", proc.currentVolume, proc.volumetricTargetValue);
    } else {
        // Add bounds check for currentPhaseStarted timestamp
        if (proc.currentPhaseStarted > 0 && now >= proc.currentPhaseStarted) {
            const unsigned long progress = now - proc.currentPhaseStarted;
            lv_bar_set_value(ui_StatusScreen_brewBar, progress, LV_ANIM_OFF);
            lv_bar_set_range(ui_StatusScreen_brewBar, 0, std::max(static_cast<int>(proc.phaseDuration), 1));
            lv_label_set_text_fmt(ui_StatusScreen_brewLabel, "%d / %ds", progress / 1000, proc.phaseDuration / 1000);
        } else {
            lv_bar_set_value(ui_StatusScreen_brewBar, 0, LV_ANIM_OFF);
            lv_bar_set_range(ui_StatusScreen_brewBar, 0, 1);
            lv_label_set_text(ui_StatusScreen_brewLabel, "0s");
        }
    }

    if (proc.target == ProcessTarget::TIME) {
        const double targetSecondsDouble = proc.totalDuration / 1000.0;
        const auto targetMinutes = static_cast<int>(targetSecondsDouble / 60.0);
        const auto targetSeconds = static_cast<int>(targetSecondsDouble) % 60;
        lv_label_set_text_fmt(ui_StatusScreen_targetDuration, "%2d:%02d", targetMinutes, targetSeconds);
    } else {
        lv_label_set_text_fmt(ui_StatusScreen_targetDuration, "%.1fg", proc.brewVolume);
    }
    lv_img_set_src(ui_StatusScreen_Image8,
                   proc.target == ProcessTarget::TIME ? &ui_img_360122106 : &ui_img_1424216268);

    if (proc.isAdvancedPump) {
        const double percentage = 1.0 - static_cast<double>(proc.pumpPressure) / static_cast<double>(pressureScaling);
        adjustTarget(uic_StatusScreen_dials_pressureTarget, percentage, -62.0, 124.0);
    } else {
        const double percentage = 1.0 - 0.5;
        adjustTarget(uic_StatusScreen_dials_pressureTarget, percentage, -62.0, 124.0);
    }

    // Brew finished adjustments - use snapshot state only to avoid TOCTOU race
    if (proc.isActive) {
        lv_obj_add_flag(ui_StatusScreen_brewVolume, LV_OBJ_FLAG_HIDDEN);
    } else {
        if (proc.target == ProcessTarget::VOLUMETRIC) {
            lv_obj_clear_flag(ui_StatusScreen_brewVolume, LV_OBJ_FLAG_HIDDEN);
        }
        lv_obj_add_flag(ui_StatusScreen_barContainer, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(ui_StatusScreen_labelContainer, LV_OBJ_FLAG_HIDDEN);
        lv_label_set_text_fmt(ui_StatusScreen_brewVolume, "%.1lfg", proc.currentVolume);
        lv_imgbtn_set_src(ui_StatusScreen_pauseButton, LV_IMGBTN_STATE_RELEASED, nullptr, &ui_img_631115820, nullptr);
    }
}

void DefaultUI::adjustDials(lv_obj_t *dials) {
    const DisplayPalette palette = makeDisplayPalette(controller->getSettings().getThemeMode(), AmoledDisplayDriver::getInstance() == panelDriver);
    const bool roundDisplay = isRoundDisplay();
    const RingVisual ringVisual =
        buildRingVisual(palette, mode, currentTemp, targetTemp, active, grindActive, controller);
    lv_obj_t *tempGauge = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPGAUGE);
    lv_obj_t *tempText = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPTEXT);
    lv_obj_t *tempTarget = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPTARGET);
    lv_obj_t *tempIcon = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPICON);
    lv_obj_t *pressureTarget = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSURETARGET);
    lv_obj_t *pressureGauge = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSUREGAUGE);
    lv_obj_t *pressureText = ui_comp_get_child(dials, UI_COMP_DIALS_PRESSURETEXT);
    lv_obj_t *pressureSymbol = ui_comp_get_child(dials, UI_COMP_DIALS_IMAGE6);
    _ui_flag_modify(pressureTarget, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    _ui_flag_modify(pressureGauge, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    _ui_flag_modify(pressureText, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    _ui_flag_modify(pressureSymbol, LV_OBJ_FLAG_HIDDEN, pressureAvailable);
    lv_obj_set_x(tempText, pressureAvailable ? -50 : 0);
    lv_obj_set_y(tempText, pressureAvailable ? -205 : -180);
    lv_arc_set_range(pressureGauge, 0, pressureScaling * 10);
    applyProcessRing(tempGauge, palette, ringVisual, roundDisplay);

    if (roundDisplay) {
        lv_obj_set_size(dials, 466, 466);
        lv_obj_align(dials, LV_ALIGN_CENTER, 0, 0);

        styleDialRing(pressureGauge, palette, palette.accentCool, true, true);
        applyProcessRing(tempGauge, palette, ringVisual, true);
        lv_arc_set_bg_angles(pressureGauge, 300, 60);

        lv_obj_set_style_text_color(tempText, palette.textPrimary, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(tempText, &ndot_34, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_text_align(tempText, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_text_color(pressureText, pressureAvailable ? palette.accent : palette.textMuted, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(pressureText, &ndot_24, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_text_align(pressureText, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);

        lv_obj_align(tempText, LV_ALIGN_TOP_MID, 0, 92);
        lv_obj_align(tempIcon, LV_ALIGN_TOP_MID, -96, 102);
        lv_img_set_zoom(tempIcon, 130);
        lv_obj_set_style_img_recolor(tempIcon, isTemperatureStable ? palette.success : palette.accent, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_img_recolor_opa(tempIcon, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);

        if (pressureAvailable) {
            lv_obj_align(pressureText, LV_ALIGN_BOTTOM_MID, 0, -94);
            lv_obj_align(pressureSymbol, LV_ALIGN_BOTTOM_MID, -92, -88);
            lv_img_set_zoom(pressureSymbol, 130);
            lv_obj_set_style_img_recolor(pressureSymbol, palette.accent, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(pressureSymbol, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }

        if (tempTarget != nullptr && lv_obj_is_valid(tempTarget)) {
            lv_obj_set_style_img_recolor(tempTarget, palette.textPrimary, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(tempTarget, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        if (pressureTarget != nullptr && lv_obj_is_valid(pressureTarget)) {
            lv_obj_set_style_img_recolor(pressureTarget, palette.accentCool, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(pressureTarget, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    }
}

inline void DefaultUI::adjustTempTarget(lv_obj_t *dials) {
    double gaugeAngle = pressureAvailable ? 124.0 : 304;
    double gaugeStart = pressureAvailable ? 118.0 : -62;
    double percentage = static_cast<double>(targetTemp) / 160.0;
    lv_obj_t *tempTarget = ui_comp_get_child(dials, UI_COMP_DIALS_TEMPTARGET);
    adjustTarget(tempTarget, percentage, gaugeStart, gaugeAngle);
}

void DefaultUI::applyTheme() {
    const Settings &settings = controller->getSettings();
    const bool amoledPanel = AmoledDisplayDriver::getInstance() == panelDriver;
    int newThemeMode = resolveDisplayThemeMode(settings.getThemeMode(), amoledPanel);

    if (newThemeMode != currentThemeMode) {
        currentThemeMode = newThemeMode;
        ui_theme_set(currentThemeMode);

        if (amoledPanel && currentThemeMode == UI_THEME_DEFAULT) {
            enable_amoled_black_theme_override(lv_disp_get_default());
        }
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
