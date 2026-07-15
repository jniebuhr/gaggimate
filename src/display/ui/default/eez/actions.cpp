#include "actions.h"
#include "screens.h"
#include "ui.h"
#include <Arduino.h>
#include <display/main.h>
#include <display/plugins/BLEScalePlugin.h>

void action_on_wakeup(lv_event_t *e) {
    if (controller.isUpdating() || controller.isErrorState() || controller.isAutotuning() ||
        !controller.getClientController()->isConnected()) {
        return;
    }
    controller.getUI()->changeScreen(SCREEN_ID_BREW_SCREEN);
    controller.deactivate();
    controller.setMode(MODE_BREW);
};

void action_on_load_started(lv_event_t *e) {

};

void action_on_menu_click(lv_event_t *e) {
    controller.deactivate();
    controller.getUI()->changeScreen(SCREEN_ID_MENU_SCREEN_NEW);
};

void action_on_brew_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_BREW_SCREEN);
    controller.deactivate();
    controller.setMode(MODE_BREW);
};

void action_on_steam_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_STEAM_SCREEN);
    controller.setMode(MODE_STEAM);
    controller.deactivate();
};

void action_on_water_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_WATER_SCREEN);
    controller.setMode(MODE_WATER);
    controller.deactivate();
};

void action_on_grind_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_GRIND_SCREEN);
    controller.setMode(MODE_GRIND);
    controller.deactivate();
};

void action_on_brew_start(lv_event_t *e) { controller.activate(); };

void action_on_flush(lv_event_t *e) { controller.onFlush(); };

void action_on_volumetric_hold(lv_event_t *e) {
    controller.getClientController()->tare();
    BLEScales.tare();
};

void action_on_profile_select(lv_event_t *e) { controller.getUI()->onProfileSwitch(); };

void action_on_profile_settings(lv_event_t *e) { controller.getUI()->changeBrewScreenMode(BrewScreenState::Settings); };

void action_on_brew_temp_lower(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.lowerTemp();
};

void action_on_brew_temp_raise(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.raiseTemp();
};

void action_on_brew_time_raise(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.raiseBrewTarget();
};

void action_on_brew_time_lower(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.lowerBrewTarget();
};

void action_on_volumetric_delete(lv_event_t *e) { controller.getUI()->onVolumetricDelete(); };

void action_on_profile_accept(lv_event_t *e) { controller.getUI()->changeBrewScreenMode(BrewScreenState::Brew); };

void action_on_profile_save(lv_event_t *e) {
    controller.onProfileSave();
    controller.getUI()->markProfileClean();
    controller.getUI()->changeBrewScreenMode(BrewScreenState::Brew);
};

void action_on_profile_save_as_new(lv_event_t *e) {

    controller.onProfileSaveAsNew();
    controller.getUI()->markProfileClean();
    controller.getUI()->changeBrewScreenMode(BrewScreenState::Brew);
};

// Repaint all of a dial meter's ticks as rounded pills/dots
void action_on_meter_draw(lv_event_t *e) {
    lv_obj_t *obj = lv_event_get_target(e);
    if (!lv_obj_check_type(obj, &lv_meter_class)) {
        return;
    }
    auto *meter = reinterpret_cast<lv_meter_t *>(obj);
    auto *scale = static_cast<lv_meter_scale_t *>(_lv_ll_get_head(&meter->scale_ll));
    if (scale == nullptr) {
        return;
    }
    const uint16_t cnt = scale->tick_major_nth; // original tick count stashed by suppressMeterTicks()
    lv_draw_ctx_t *draw_ctx = lv_event_get_draw_ctx(e);
    if (cnt < 2 || scale->tick_length == 0 || draw_ctx == nullptr) {
        return;
    }

    lv_area_t content;
    lv_obj_get_content_coords(obj, &content);
    const lv_coord_t r_edge = LV_MIN(lv_area_get_width(&content), lv_area_get_height(&content)) / 2;
    const lv_coord_t cx = content.x1 + r_edge;
    const lv_coord_t cy = content.y1 + r_edge;
    // Pull the ring in 2px so round cap/dot tips clear the meter's outer radius (else they look shaved).
    const lv_coord_t r_out = r_edge - 2;
    const lv_coord_t r_in = r_out - scale->tick_length;
    const lv_coord_t cap = scale->tick_width / 2;
    const bool pill = scale->tick_length > scale->tick_width; // collapses to a dot once shorter than wide

    lv_draw_line_dsc_t line_dsc;
    lv_draw_line_dsc_init(&line_dsc);
    lv_obj_init_draw_line_dsc(obj, LV_PART_TICKS, &line_dsc);
    line_dsc.width = scale->tick_width;
    line_dsc.round_start = 1;
    line_dsc.round_end = 1;
    line_dsc.raw_end = 0;
    line_dsc.opa = LV_OPA_COVER;

    lv_draw_rect_dsc_t dot_dsc;
    lv_draw_rect_dsc_init(&dot_dsc);
    dot_dsc.radius = LV_RADIUS_CIRCLE;
    dot_dsc.bg_opa = LV_OPA_COVER;
    const float rad = scale->tick_length / 2.0f;
    const float cr = r_out - rad; // dot band centre
    const lv_coord_t ri = (lv_coord_t)lroundf(rad);
    constexpr float DEG2RAD = 3.14159265358979323846f / 180.0f;

    for (uint16_t i = 0; i < cnt; i++) {
        const int32_t value = lv_map(i, 0, cnt - 1, scale->min, scale->max);

        // SCALE_LINES indicators light up the ticks within their [start,end] range (the current level).
        lv_color_t color = scale->tick_color;
        for (auto *indic = static_cast<lv_meter_indicator_t *>(_lv_ll_get_tail(&meter->indicator_ll)); indic != nullptr;
             indic = static_cast<lv_meter_indicator_t *>(_lv_ll_get_prev(&meter->indicator_ll, indic))) {
            if (indic->type != LV_METER_INDICATOR_TYPE_SCALE_LINES)
                continue;
            if (value < indic->start_value || value > indic->end_value)
                continue;
            if (indic->type_data.scale_lines.color_start.full == indic->type_data.scale_lines.color_end.full) {
                color = indic->type_data.scale_lines.color_start;
            } else {
                const lv_opa_t ratio = indic->type_data.scale_lines.local_grad
                                           ? lv_map(value, indic->start_value, indic->end_value, LV_OPA_TRANSP, LV_OPA_COVER)
                                           : lv_map(value, scale->min, scale->max, LV_OPA_TRANSP, LV_OPA_COVER);
                color = lv_color_mix(indic->type_data.scale_lines.color_end, indic->type_data.scale_lines.color_start, ratio);
            }
        }

        const float angle = ((float)i * scale->angle_range / (cnt - 1) + scale->rotation) * DEG2RAD;
        const float ux = cosf(angle);
        const float uy = sinf(angle);

        if (pill) {
            // Round (not truncate) the coords so every tick lands evenly on the pixel grid.
            lv_point_t inner = {(lv_coord_t)lroundf(cx + ux * (r_in + cap)), (lv_coord_t)lroundf(cy + uy * (r_in + cap))};
            lv_point_t outer = {(lv_coord_t)lroundf(cx + ux * (r_out - cap)), (lv_coord_t)lroundf(cy + uy * (r_out - cap))};
            line_dsc.color = color;
            lv_draw_line(draw_ctx, &line_dsc, &inner, &outer);
        } else {
            const lv_coord_t dx = (lv_coord_t)lroundf(cx + ux * cr);
            const lv_coord_t dy = (lv_coord_t)lroundf(cy + uy * cr);
            dot_dsc.bg_color = color;
            lv_area_t area = {(lv_coord_t)(dx - ri), (lv_coord_t)(dy - ri), (lv_coord_t)(dx + ri), (lv_coord_t)(dy + ri)};
            lv_draw_rect(draw_ctx, &dot_dsc, &area);
        }
    }
};

void action_on_steam_temp_lower(lv_event_t *e) { controller.lowerTemp(); };

void action_on_steam_temp_raise(lv_event_t *e) { controller.raiseTemp(); };

void action_on_grind_time_lower(lv_event_t *e) { controller.lowerGrindTarget(); };

void action_on_grind_time_raise(lv_event_t *e) { controller.raiseGrindTarget(); };

void action_on_timed_click(lv_event_t *e) {

};

void action_on_volumetric_click(lv_event_t *e) {
    controller.onTargetToggle();
    controller.getUI()->markDirty();
};

void action_on_grind_toggle(lv_event_t *e) {
    controller.isGrindActive() ? controller.deactivateGrind() : controller.activateGrind();
};

void action_on_simple_process_toggle(lv_event_t *e) {
    if (controller.getMode() != MODE_STEAM) {
        controller.isActive() ? controller.deactivate() : controller.activate();
    }
};

void action_on_profile_load(lv_event_t *e) { controller.getUI()->onProfileSelect(); };

void action_on_previous_profile(lv_event_t *e) { controller.getUI()->onPreviousProfile(); };

void action_on_next_profile(lv_event_t *e) { controller.getUI()->onNextProfile(); };

void action_on_brew_cancel(lv_event_t *e) {
    controller.deactivate();
    controller.clear();
}

void action_on_standby(lv_event_t *e) { controller.activateStandby(); }

void applyClickArea(lv_obj_t *obj, lv_coord_t size) {
    if (obj == nullptr) {
        return;
    }
    lv_obj_set_ext_click_area(obj, size);
}

// Stop lv_meter drawing its own ticks (action_on_meter_draw takes over): stash the design count in the
// unused tick_major_nth, then zero the live count. Once per meter; self-cleans if EEZ recreates the screen.
static void suppressMeterTicks(lv_obj_t *obj) {
    const uint32_t n = lv_obj_get_child_cnt(obj);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *child = lv_obj_get_child(obj, i);
        if (lv_obj_check_type(child, &lv_meter_class)) {
            auto *meter = reinterpret_cast<lv_meter_t *>(child);
            auto *scale = static_cast<lv_meter_scale_t *>(_lv_ll_get_head(&meter->scale_ll));
            if (scale != nullptr && scale->tick_cnt > 0) {
                scale->tick_major_nth = scale->tick_cnt;
                scale->tick_cnt = 0;
            }
        }
        suppressMeterTicks(child);
    }
}

void action_on_screen_load(lv_event_t *e) {
    suppressMeterTicks(lv_event_get_target(e));
    applyClickArea(objects.select_profile, 30);
    applyClickArea(objects.previous_profile, 30);
    applyClickArea(objects.next_profile, 30);
    applyClickArea(objects.btn_brew_1, 15);
    applyClickArea(objects.btn_steam_1, 15);
    applyClickArea(objects.btn_water_1, 15);
    applyClickArea(objects.btn_grind_1, 15);
    applyClickArea(objects.btn_settings_1, 15);
    applyClickArea(objects.info_btn, 15);
    applyClickArea(objects.menu_dials__standby_icon, 20);
    applyClickArea(objects.standby_btn, 20);
    applyClickArea(objects.brew_dials__menu_icon, 20);
    applyClickArea(objects.status_dials__menu_icon, 20);
    applyClickArea(objects.steam_dials__menu_icon, 20);
    applyClickArea(objects.water_dials__menu_icon, 20);
    applyClickArea(objects.grind_dials__menu_icon, 20);
    applyClickArea(objects.profile_dials__menu_icon, 20);
    applyClickArea(objects.info_menu_icon, 20);
    applyClickArea(objects.start_button, 25);
    applyClickArea(objects.water_start_button, 25);
    applyClickArea(objects.grind_start_button, 25);
    applyClickArea(objects.profile_select_button, 25);
    applyClickArea(objects.settings_button, 25);
    applyClickArea(objects.up_duration_button, 15);
    applyClickArea(objects.down_duration_button, 15);
    applyClickArea(objects.up_weight_button, 15);
    applyClickArea(objects.down_weight_button, 15);
    applyClickArea(objects.up_temp_button, 15);
    applyClickArea(objects.down_temp_button, 15);
    applyClickArea(objects.water_up_temp_button, 15);
    applyClickArea(objects.water_down_temp_button, 15);
    applyClickArea(objects.steam_up_temp_button, 15);
    applyClickArea(objects.steam_down_temp_button, 15);
    applyClickArea(objects.grind_up_duration_button, 15);
    applyClickArea(objects.grind_down_duration_button, 15);
    applyClickArea(objects.grind_up_weight_button, 15);
    applyClickArea(objects.grind_down_weight_button, 15);
    applyClickArea(objects.pause_button, 25);
    applyClickArea(objects.check_button, 25);
    applyClickArea(objects.accept_button, 20);
    applyClickArea(objects.save_as_new_button, 20);
    applyClickArea(objects.save_button, 20);
}

void action_on_screen_swipe(lv_event_t *e) {
    lv_event_code_t event_code = lv_event_get_code(e);

    if (event_code == LV_EVENT_GESTURE) {
        if (lv_indev_get_gesture_dir(lv_indev_get_act()) == LV_DIR_TOP) {
            lv_indev_wait_release(lv_indev_get_act());
            action_on_menu_click(e);
        } else if (lv_indev_get_gesture_dir(lv_indev_get_act()) == LV_DIR_RIGHT &&
                   eez_flow_get_current_screen() == SCREEN_ID_PROFILE_SCREEN) {
            lv_indev_wait_release(lv_indev_get_act());
            action_on_previous_profile(e);
        } else if (lv_indev_get_gesture_dir(lv_indev_get_act()) == LV_DIR_LEFT &&
                   eez_flow_get_current_screen() == SCREEN_ID_PROFILE_SCREEN) {
            lv_indev_wait_release(lv_indev_get_act());
            action_on_next_profile(e);
        }
    }
}

void action_on_info_screen(lv_event_t *e) { controller.getUI()->changeScreen(SCREEN_ID_INFO_SCREEN); }
