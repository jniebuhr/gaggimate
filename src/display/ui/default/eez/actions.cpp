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

void action_on_meter_draw(lv_event_t *e) {
    // Render the meter scale ticks as pills (rounded ends).
    lv_obj_draw_part_dsc_t *dsc = lv_event_get_draw_part_dsc(e);
    if (dsc == nullptr || dsc->class_p != &lv_meter_class || dsc->type != LV_METER_DRAW_PART_TICK || dsc->line_dsc == nullptr ||
        dsc->p1 == nullptr || dsc->p2 == nullptr || dsc->draw_ctx == nullptr) {
        return;
    }
    auto *scale = static_cast<const lv_meter_scale_t *>(dsc->sub_part_ptr);
    if (scale == nullptr) {
        return;
    }

    lv_obj_t *obj = lv_event_get_target(e);
    lv_area_t content;
    lv_obj_get_content_coords(obj, &content);
    // Pull the ring in 2px so round cap/dot tips clear the meter's outer radius mask (else they look shaved).
    const lv_coord_t r_out = LV_MIN(lv_area_get_width(&content), lv_area_get_height(&content)) / 2 - 2;
    const lv_coord_t r_in = r_out - scale->tick_length;
    const lv_coord_t cap = dsc->line_dsc->width / 2;

    // Unit vector from the meter center (p1) outwards towards the tick (p2).
    const float dx = (float)(dsc->p2->x - dsc->p1->x);
    const float dy = (float)(dsc->p2->y - dsc->p1->y);
    const float len = sqrtf(dx * dx + dy * dy);
    if (len < 1.0f || r_in >= r_out) {
        return;
    }
    const float ux = dx / len;
    const float uy = dy / len;

    if (scale->tick_length > dsc->line_dsc->width) {
        // Tall enough for a pill: a line with round caps, inset by the cap radius so the caps land on
        // r_in/r_out. Round (not truncate) the coords so every tick lands evenly on the pixel grid.
        lv_point_t inner = {(lv_coord_t)lroundf(dsc->p1->x + ux * (r_in + cap)),
                            (lv_coord_t)lroundf(dsc->p1->y + uy * (r_in + cap))};
        lv_point_t outer = {(lv_coord_t)lroundf(dsc->p1->x + ux * (r_out - cap)),
                            (lv_coord_t)lroundf(dsc->p1->y + uy * (r_out - cap))};
        lv_draw_line_dsc_t pill = *dsc->line_dsc;
        pill.opa = LV_OPA_COVER; // ticks are opaque; guard against the persisted suppression below
        pill.round_start = 1;
        pill.round_end = 1;
        pill.raw_end = 0;
        lv_draw_line(dsc->draw_ctx, &pill, &inner, &outer);
    } else {
        // Band is one width tall or less: the pill has collapsed to a dot, so draw a filled circle.
        // (lv_draw_line renders nothing for a zero-length line, which is why short ticks vanished.)
        const float rad = scale->tick_length / 2.0f;
        const float cr = r_out - rad; // centre of the tick band
        const lv_coord_t cx = (lv_coord_t)lroundf(dsc->p1->x + ux * cr);
        const lv_coord_t cy = (lv_coord_t)lroundf(dsc->p1->y + uy * cr);
        const lv_coord_t ri = (lv_coord_t)lroundf(rad);
        lv_draw_rect_dsc_t dot;
        lv_draw_rect_dsc_init(&dot);
        dot.bg_color = dsc->line_dsc->color;
        dot.bg_opa = LV_OPA_COVER;
        dot.radius = LV_RADIUS_CIRCLE;
        lv_area_t area = {(lv_coord_t)(cx - ri), (lv_coord_t)(cy - ri), (lv_coord_t)(cx + ri), (lv_coord_t)(cy + ri)};
        lv_draw_rect(dsc->draw_ctx, &dot, &area);
    }

    // Suppress lv_meter's own sharp-cornered tick (we drew the rounded one).
    dsc->line_dsc->opa = LV_OPA_TRANSP;
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

void action_on_screen_load(lv_event_t *e) {
    applyClickArea(objects.select_profile, 30);
    applyClickArea(objects.previous_profile, 30);
    applyClickArea(objects.next_profile, 30);
    applyClickArea(objects.btn_brew_1, 15);
    applyClickArea(objects.btn_steam_1, 15);
    applyClickArea(objects.btn_water_1, 15);
    applyClickArea(objects.btn_grind_1, 15);
    applyClickArea(objects.btn_info_1, 15);
    applyClickArea(objects.menu_dials__standby_icon, 20);
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
