#include <string.h>

#include "actions.h"
#include "fonts.h"
#include "images.h"
#include "screens.h"
#include "styles.h"
#include "ui.h"
#include "vars.h"

#include <string.h>

objects_t objects;

static const char *screen_names[] = {"StandbyScreen", "BrewScreen",       "StatusScreen",  "MenuScreen",
                                     "SteamScreen",   "WaterScreen",      "ProfileScreen", "GrindScreen",
                                     "InfoScreen",    "NewProfileScreen", "MenuScreen_1"};
static const char *object_names[] = {"standby_screen",
                                     "brew_screen",
                                     "status_screen",
                                     "menu_screen",
                                     "steam_screen",
                                     "water_screen",
                                     "profile_screen",
                                     "grind_screen",
                                     "info_screen",
                                     "new_profile_screen",
                                     "menu_screen_1",
                                     "obj0",
                                     "obj0__temp_gauge",
                                     "obj0__temp_gauge_full",
                                     "obj0__pressure_gauge",
                                     "obj0__standby_icon",
                                     "obj0__menu_icon",
                                     "obj0__temp_icon",
                                     "obj0__pressure_icon",
                                     "obj0__pressure_text",
                                     "obj0__temp_text",
                                     "obj0__temp_text_full",
                                     "obj1",
                                     "obj1__temp_gauge",
                                     "obj1__temp_gauge_full",
                                     "obj1__pressure_gauge",
                                     "obj1__standby_icon",
                                     "obj1__menu_icon",
                                     "obj1__temp_icon",
                                     "obj1__pressure_icon",
                                     "obj1__pressure_text",
                                     "obj1__temp_text",
                                     "obj1__temp_text_full",
                                     "obj2",
                                     "obj2__temp_gauge",
                                     "obj2__temp_gauge_full",
                                     "obj2__pressure_gauge",
                                     "obj2__standby_icon",
                                     "obj2__menu_icon",
                                     "obj2__temp_icon",
                                     "obj2__pressure_icon",
                                     "obj2__pressure_text",
                                     "obj2__temp_text",
                                     "obj2__temp_text_full",
                                     "obj3",
                                     "obj3__temp_gauge",
                                     "obj3__temp_gauge_full",
                                     "obj3__pressure_gauge",
                                     "obj3__standby_icon",
                                     "obj3__menu_icon",
                                     "obj3__temp_icon",
                                     "obj3__pressure_icon",
                                     "obj3__pressure_text",
                                     "obj3__temp_text",
                                     "obj3__temp_text_full",
                                     "obj4",
                                     "obj4__temp_gauge",
                                     "obj4__temp_gauge_full",
                                     "obj4__pressure_gauge",
                                     "obj4__standby_icon",
                                     "obj4__menu_icon",
                                     "obj4__temp_icon",
                                     "obj4__pressure_icon",
                                     "obj4__pressure_text",
                                     "obj4__temp_text",
                                     "obj4__temp_text_full",
                                     "obj5",
                                     "obj5__temp_gauge",
                                     "obj5__temp_gauge_full",
                                     "obj5__pressure_gauge",
                                     "obj5__standby_icon",
                                     "obj5__menu_icon",
                                     "obj5__temp_icon",
                                     "obj5__pressure_icon",
                                     "obj5__pressure_text",
                                     "obj5__temp_text",
                                     "obj5__temp_text_full",
                                     "obj6",
                                     "obj6__temp_gauge",
                                     "obj6__temp_gauge_full",
                                     "obj6__pressure_gauge",
                                     "obj6__standby_icon",
                                     "obj6__menu_icon",
                                     "obj6__temp_icon",
                                     "obj6__pressure_icon",
                                     "obj6__pressure_text",
                                     "obj6__temp_text",
                                     "obj6__temp_text_full",
                                     "obj7",
                                     "touch_icon",
                                     "time",
                                     "standby_icons",
                                     "wifi_icon",
                                     "bluetooth_icon",
                                     "update_icon",
                                     "status",
                                     "obj8",
                                     "start_button",
                                     "control_container",
                                     "mode_switch",
                                     "bluetooth_scale_icon",
                                     "flow_prediction_icon",
                                     "weight_label",
                                     "profile_info",
                                     "obj9",
                                     "profile_select_button",
                                     "profile_name",
                                     "settings_button",
                                     "adjustments",
                                     "temp_container",
                                     "target_temp",
                                     "down_temp_button",
                                     "up_temp_button",
                                     "obj10",
                                     "brew_target_time_container",
                                     "target_duration",
                                     "obj11",
                                     "up_duration_button",
                                     "down_duration_button",
                                     "brew_target_weight_container",
                                     "target_weight_1",
                                     "obj12",
                                     "up_weight_button",
                                     "down_weight_button",
                                     "remove_volumetric_button",
                                     "save_button",
                                     "accept_button",
                                     "save_as_new_button",
                                     "obj13",
                                     "target_duration_1",
                                     "target_weight_2",
                                     "target_temp_1",
                                     "image7",
                                     "image8",
                                     "image9",
                                     "pause_button",
                                     "check_button",
                                     "current_duration",
                                     "step_label",
                                     "phase_label",
                                     "bar_container",
                                     "brew_bar",
                                     "phase_progress",
                                     "process_volume",
                                     "btn_brew",
                                     "btn_steam",
                                     "btn_water",
                                     "btn_grind",
                                     "main_label5",
                                     "image5_1",
                                     "target_temp2",
                                     "steam_down_temp_button",
                                     "steam_up_temp_button",
                                     "obj14",
                                     "main_label6",
                                     "water_down_temp_button",
                                     "target_temp3",
                                     "image10",
                                     "water_up_temp_button",
                                     "water_start_button",
                                     "obj15",
                                     "profile_name_1",
                                     "profile_temp_time",
                                     "obj16",
                                     "obj17",
                                     "obj18",
                                     "obj19",
                                     "obj20",
                                     "obj21",
                                     "obj22",
                                     "select_profile",
                                     "previous_profile",
                                     "next_profile",
                                     "main_label4",
                                     "grind_start_button",
                                     "mode_switch1",
                                     "obj23",
                                     "obj24",
                                     "target_weight",
                                     "target_duration3_1",
                                     "target_symbol_1",
                                     "grind_down_weight_button",
                                     "grind_up_weight_button",
                                     "target_time",
                                     "target_duration3",
                                     "target_symbol",
                                     "grind_down_duration_button",
                                     "grind_up_duration_button",
                                     "standby_icons_1",
                                     "wifi_icon_1",
                                     "bluetooth_icon_1",
                                     "update_icon_1",
                                     "obj25",
                                     "obj26",
                                     "obj27",
                                     "obj28",
                                     "obj29",
                                     "update_icon_2",
                                     "update_icon_3",
                                     "menu_icon_2",
                                     "obj30",
                                     "single_view",
                                     "prev_button",
                                     "obj31",
                                     "phase_preview",
                                     "obj32",
                                     "obj33",
                                     "obj34",
                                     "obj35",
                                     "obj36",
                                     "obj37",
                                     "obj38",
                                     "image_preview",
                                     "profile_preview",
                                     "obj39",
                                     "select_button",
                                     "next_button",
                                     "list_view",
                                     "obj40",
                                     "obj41",
                                     "obj42",
                                     "obj43",
                                     "obj44",
                                     "obj45",
                                     "obj46",
                                     "obj47",
                                     "obj48",
                                     "obj49",
                                     "obj50",
                                     "obj51",
                                     "obj52",
                                     "obj53",
                                     "obj54",
                                     "obj55",
                                     "obj56",
                                     "obj57",
                                     "obj58",
                                     "obj59",
                                     "obj60",
                                     "obj61",
                                     "obj62",
                                     "obj63",
                                     "obj64",
                                     "obj65",
                                     "obj66",
                                     "btn_brew_1",
                                     "btn_steam_1",
                                     "btn_water_1",
                                     "btn_grind_1",
                                     "btn_settings_1",
                                     "btn_info_1",
                                     "standby_button",
                                     "obj67",
                                     "obj68",
                                     "obj69",
                                     "obj70",
                                     "obj71"};

screen_brew_screen_state_t screen_brew_screen_state;
screen_status_screen_state_t screen_status_screen_state;
screen_menu_screen_state_t screen_menu_screen_state;
screen_steam_screen_state_t screen_steam_screen_state;
screen_water_screen_state_t screen_water_screen_state;
screen_profile_screen_state_t screen_profile_screen_state;
screen_grind_screen_state_t screen_grind_screen_state;

//
// Event handlers
//

lv_obj_t *tick_value_change_obj;

static void event_handler_cb_standby_screen_standby_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_wakeup(e);
    }
}

static void event_handler_cb_brew_screen_brew_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
    if (event == LV_EVENT_GESTURE) {
        e->user_data = (void *)0;
        action_on_screen_swipe(e);
    }
}

static void event_handler_cb_brew_screen_start_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_start(e);
    }
    if (event == LV_EVENT_LONG_PRESSED) {
        e->user_data = (void *)0;
        action_on_flush(e);
    }
}

static void event_handler_cb_brew_screen_mode_switch(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_volumetric_click(e);
    }
    if (event == LV_EVENT_LONG_PRESSED) {
        e->user_data = (void *)0;
        action_on_volumetric_hold(e);
    }
}

static void event_handler_cb_brew_screen_profile_select_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_profile_select(e);
    }
}

static void event_handler_cb_brew_screen_settings_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_profile_settings(e);
    }
}

static void event_handler_cb_brew_screen_down_temp_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_temp_lower(e);
    }
}

static void event_handler_cb_brew_screen_up_temp_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_temp_raise(e);
    }
}

static void event_handler_cb_brew_screen_up_duration_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_time_raise(e);
    }
}

static void event_handler_cb_brew_screen_down_duration_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_time_lower(e);
    }
}

static void event_handler_cb_brew_screen_up_weight_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_time_raise(e);
    }
}

static void event_handler_cb_brew_screen_down_weight_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_time_lower(e);
    }
}

static void event_handler_cb_brew_screen_remove_volumetric_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_volumetric_delete(e);
    }
}

static void event_handler_cb_brew_screen_save_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_profile_save(e);
    }
}

static void event_handler_cb_brew_screen_accept_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_profile_accept(e);
    }
}

static void event_handler_cb_brew_screen_save_as_new_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_profile_save_as_new(e);
    }
}

static void event_handler_cb_status_screen_status_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_GESTURE) {
        e->user_data = (void *)0;
        action_on_screen_swipe(e);
    }
    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
}

static void event_handler_cb_status_screen_pause_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_cancel(e);
    }
}

static void event_handler_cb_status_screen_check_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_cancel(e);
    }
}

static void event_handler_cb_menu_screen_menu_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
}

static void event_handler_cb_menu_screen_btn_brew(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_screen(e);
    }
}

static void event_handler_cb_menu_screen_btn_steam(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_steam_screen(e);
    }
}

static void event_handler_cb_menu_screen_btn_water(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_water_screen(e);
    }
}

static void event_handler_cb_menu_screen_btn_grind(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_screen(e);
    }
}

static void event_handler_cb_steam_screen_steam_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
    if (event == LV_EVENT_GESTURE) {
        e->user_data = (void *)0;
        action_on_screen_swipe(e);
    }
}

static void event_handler_cb_steam_screen_steam_down_temp_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_steam_temp_lower(e);
    }
}

static void event_handler_cb_steam_screen_steam_up_temp_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_steam_temp_raise(e);
    }
}

static void event_handler_cb_water_screen_water_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_GESTURE) {
        e->user_data = (void *)0;
        action_on_screen_swipe(e);
    }
    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
}

static void event_handler_cb_water_screen_water_down_temp_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_steam_temp_lower(e);
    }
}

static void event_handler_cb_water_screen_water_up_temp_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_steam_temp_raise(e);
    }
}

static void event_handler_cb_water_screen_water_start_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(flowState, 9, 3, value, "Failed to assign Checked state");
        }
    }
    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_simple_process_toggle(e);
    }
}

static void event_handler_cb_profile_screen_profile_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
    if (event == LV_EVENT_GESTURE) {
        e->user_data = (void *)0;
        action_on_screen_swipe(e);
    }
}

static void event_handler_cb_profile_screen_select_profile(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_profile_load(e);
    }
}

static void event_handler_cb_profile_screen_previous_profile(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_previous_profile(e);
    }
}

static void event_handler_cb_profile_screen_next_profile(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_next_profile(e);
    }
}

static void event_handler_cb_grind_screen_grind_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
    if (event == LV_EVENT_GESTURE) {
        e->user_data = (void *)0;
        action_on_screen_swipe(e);
    }
}

static void event_handler_cb_grind_screen_grind_start_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(flowState, 4, 3, value, "Failed to assign Checked state");
        }
    }
    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_toggle(e);
    }
}

static void event_handler_cb_grind_screen_mode_switch1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(flowState, 5, 4, value, "Failed to assign Checked state");
        }
    }
    if (event == LV_EVENT_LONG_PRESSED) {
        e->user_data = (void *)0;
        action_on_volumetric_hold(e);
    }
    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_volumetric_click(e);
    }
}

static void event_handler_cb_grind_screen_obj23(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(flowState, 6, 3, value, "Failed to assign Checked state");
        }
    }
}

static void event_handler_cb_grind_screen_obj24(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(flowState, 7, 3, value, "Failed to assign Checked state");
        }
    }
}

static void event_handler_cb_grind_screen_grind_down_weight_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_time_lower(e);
    }
}

static void event_handler_cb_grind_screen_grind_up_weight_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_time_raise(e);
    }
}

static void event_handler_cb_grind_screen_grind_down_duration_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_time_lower(e);
    }
}

static void event_handler_cb_grind_screen_grind_up_duration_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_time_raise(e);
    }
}

static void event_handler_cb_info_screen_info_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_wakeup(e);
    }
}

static void event_handler_cb_info_screen_menu_icon_2(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_menu_click(e);
    }
}

static void event_handler_cb_new_profile_screen_new_profile_screen(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_load_started(e);
    }
}

static void event_handler_cb_menu_screen_1_menu_screen_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_SCREEN_LOADED) {
        e->user_data = (void *)0;
        action_on_screen_load(e);
    }
}

static void event_handler_cb_menu_screen_1_btn_brew_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_brew_screen(e);
    }
}

static void event_handler_cb_menu_screen_1_btn_steam_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_steam_screen(e);
    }
}

static void event_handler_cb_menu_screen_1_btn_water_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_water_screen(e);
    }
}

static void event_handler_cb_menu_screen_1_btn_grind_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_screen(e);
    }
}

static void event_handler_cb_menu_screen_1_btn_settings_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_screen(e);
    }
}

static void event_handler_cb_menu_screen_1_btn_info_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_grind_screen(e);
    }
}

static void event_handler_cb_menu_screen_1_standby_button(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_standby(e);
    }
}

static void event_handler_cb_dials_temp_gauge(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_DRAW_PART_BEGIN) {
        e->user_data = (void *)0;
        action_on_meter_draw(e);
    }
}

static void event_handler_cb_dials_temp_gauge_full(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_DRAW_PART_BEGIN) {
        e->user_data = (void *)0;
        action_on_meter_draw(e);
    }
}

static void event_handler_cb_dials_pressure_gauge(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_DRAW_PART_BEGIN) {
        e->user_data = (void *)0;
        action_on_meter_draw(e);
    }
}

static void event_handler_cb_dials_standby_icon(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_standby(e);
    }
}

static void event_handler_cb_dials_menu_icon(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_CLICKED) {
        e->user_data = (void *)0;
        action_on_menu_click(e);
    }
}

static void event_handler_cb_dials_temp_icon(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    void *flowState = lv_event_get_user_data(e);
    (void)flowState;

    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
            assignBooleanProperty(flowState, 5, 3, value, "Failed to assign Checked state");
        }
    }
}

//
// Screens
//

void create_screen_standby_screen() {
    void *flowState = getFlowState(0, 0);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.standby_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_standby_screen_standby_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.obj7 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_logo);
            lv_img_set_zoom(obj, 210);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // touchIcon
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.touch_icon = obj;
            lv_obj_set_pos(obj, 0, 150);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_tap_60x60);
            lv_img_set_zoom(obj, 210);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // time
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.time = obj;
            lv_obj_set_pos(obj, 0, -150);
            lv_obj_set_size(obj, 150, LV_SIZE_CONTENT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_34, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
        {
            // standbyIcons
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.standby_icons = obj;
            lv_obj_set_pos(obj, 0, -210);
            lv_obj_set_size(obj, 300, 20);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // wifiIcon
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.wifi_icon = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_wifi_20x20);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // bluetoothIcon
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.bluetooth_icon = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_bluetooth_alt_20x20);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // updateIcon
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.update_icon = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_refresh_20x20);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
        {
            // status
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.status = obj;
            lv_obj_set_pos(obj, 0, 150);
            lv_obj_set_size(obj, 250, LV_SIZE_CONTENT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
    }

    tick_screen_standby_screen();
}

void delete_screen_standby_screen() {
    lv_obj_del(objects.standby_screen);
    objects.standby_screen = 0;
    objects.obj7 = 0;
    objects.touch_icon = 0;
    objects.time = 0;
    objects.standby_icons = 0;
    objects.wifi_icon = 0;
    objects.bluetooth_icon = 0;
    objects.update_icon = 0;
    objects.status = 0;
    deletePageFlowState(0);
}

void tick_screen_standby_screen() {
    void *flowState = getFlowState(0, 0);
    (void)flowState;
    {
        bool new_val = evalBooleanProperty(flowState, 2, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.touch_icon, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.touch_icon;
            if (new_val) {
                lv_obj_add_flag(objects.touch_icon, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.touch_icon, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 3, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.time);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.time;
            lv_label_set_text(objects.time, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 3, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.time, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.time;
            if (new_val) {
                lv_obj_add_flag(objects.time, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.time, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 4, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.standby_icons, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.standby_icons;
            if (new_val) {
                lv_obj_add_flag(objects.standby_icons, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.standby_icons, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 5, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.wifi_icon, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.wifi_icon;
            if (new_val) {
                lv_obj_add_flag(objects.wifi_icon, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.wifi_icon, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 6, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.bluetooth_icon, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.bluetooth_icon;
            if (new_val) {
                lv_obj_add_flag(objects.bluetooth_icon, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.bluetooth_icon, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 7, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.update_icon, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.update_icon;
            if (new_val) {
                lv_obj_add_flag(objects.update_icon, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.update_icon, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 8, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.status);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.status;
            lv_label_set_text(objects.status, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 8, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.status, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.status;
            if (new_val) {
                lv_obj_add_flag(objects.status, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.status, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_brew_screen() {
    screen_brew_screen_state_t *state = &screen_brew_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 1);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.brew_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_brew_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj0 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 12, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.obj8 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // startButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.start_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_start_button, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // controlContainer
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.control_container = obj;
                    lv_obj_set_pos(obj, 0, -19);
                    lv_obj_set_size(obj, 360, 214);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                               LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM |
                                               LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // modeSwitch
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.mode_switch = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 160, 50);
                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_mode_switch, LV_EVENT_ALL, flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR |
                                                       LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_ELASTIC |
                                                       LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                      LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_AROUND, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    // bluetoothScaleIcon
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    objects.bluetooth_scale_icon = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_img_set_src(obj, &img_equality_40x40);
                                    lv_obj_set_style_img_recolor(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    // flowPredictionIcon
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    objects.flow_prediction_icon = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_img_set_src(obj, &img_flowmeter);
                                    lv_obj_set_style_img_recolor(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    // weightLabel
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.weight_label = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 90, 24);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text(obj, "");
                                }
                            }
                        }
                        {
                            // profileInfo
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.profile_info = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 360, 120);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_row(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_column(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.obj9 = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text_static(obj, "Selected profile");
                                }
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, 1769, 0);
                                    lv_obj_set_size(obj, 360, 40);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_column(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            // profileSelectButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.profile_select_button = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_dropdown_bar_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_profile_select_button,
                                                                LV_EVENT_ALL, flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // profileName
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.profile_name = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_label_set_long_mode(obj, LV_LABEL_LONG_SCROLL_CIRCULAR);
                                            lv_obj_set_style_flex_grow(obj, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "");
                                        }
                                        {
                                            // settingsButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.settings_button = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_settings_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_settings_button, LV_EVENT_ALL,
                                                                flowState);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                    }
                                }
                            }
                        }
                        {
                            // adjustments
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.adjustments = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 360, 120);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR |
                                                       LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_ELASTIC |
                                                       LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_row(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    // tempContainer
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    objects.temp_container = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 360, 50);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            // targetTemp
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.target_temp = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, 90, 30);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER,
                                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "");
                                        }
                                        {
                                            // downTempButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.down_temp_button = obj;
                                            lv_obj_set_pos(obj, -80, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_down_temp_button, LV_EVENT_ALL,
                                                                flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // upTempButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.up_temp_button = obj;
                                            lv_obj_set_pos(obj, 80, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_up_temp_button, LV_EVENT_ALL,
                                                                flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj10 = obj;
                                            lv_obj_set_pos(obj, -140, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                    }
                                }
                                {
                                    // brewTargetTimeContainer
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    objects.brew_target_time_container = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 360, 50);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR |
                                                               LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_ELASTIC |
                                                               LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            // targetDuration
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.target_duration = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, 90, 30);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER,
                                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "");
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj11 = obj;
                                            lv_obj_set_pos(obj, -140, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_clock_40x40);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // upDurationButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.up_duration_button = obj;
                                            lv_obj_set_pos(obj, 80, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_up_duration_button,
                                                                LV_EVENT_ALL, flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // downDurationButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.down_duration_button = obj;
                                            lv_obj_set_pos(obj, -80, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_down_duration_button,
                                                                LV_EVENT_ALL, flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                    }
                                }
                                {
                                    // brewTargetWeightContainer
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    objects.brew_target_weight_container = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 360, 50);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR |
                                                               LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_ELASTIC |
                                                               LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            // targetWeight_1
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.target_weight_1 = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, 90, 30);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER,
                                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "");
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj12 = obj;
                                            lv_obj_set_pos(obj, -140, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_equality_40x40);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // upWeightButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.up_weight_button = obj;
                                            lv_obj_set_pos(obj, 80, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_up_weight_button, LV_EVENT_ALL,
                                                                flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // downWeightButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.down_weight_button = obj;
                                            lv_obj_set_pos(obj, -80, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_down_weight_button,
                                                                LV_EVENT_ALL, flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            // removeVolumetricButton
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.remove_volumetric_button = obj;
                                            lv_obj_set_pos(obj, 140, 0);
                                            lv_obj_set_size(obj, 40, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_clock_future_past_40x40,
                                                              NULL);
                                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_remove_volumetric_button,
                                                                LV_EVENT_ALL, flowState);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                {
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.obj13 = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 280, 45);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_AROUND, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // saveButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.save_button = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 30, 30);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_disk_30x30, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_save_button, LV_EVENT_ALL, flowState);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_blend_mode(obj, LV_BLEND_MODE_NORMAL, LV_PART_MAIN | LV_STATE_DISABLED);
                            lv_obj_set_style_img_opa(obj, 125, LV_PART_MAIN | LV_STATE_DISABLED);
                        }
                        {
                            // acceptButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.accept_button = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 40, 40);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_check_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_accept_button, LV_EVENT_ALL, flowState);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // saveAsNewButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.save_as_new_button = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 30, 30);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_floppy_disks_30x30, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_brew_screen_save_as_new_button, LV_EVENT_ALL, flowState);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_opa(obj, 125, LV_PART_MAIN | LV_STATE_DISABLED);
                        }
                    }
                }
            }
        }
    }

    tick_screen_brew_screen();
}

void delete_screen_brew_screen() {
    lv_obj_del(objects.brew_screen);
    objects.brew_screen = 0;
    objects.obj0 = 0;
    objects.obj8 = 0;
    objects.start_button = 0;
    objects.control_container = 0;
    objects.mode_switch = 0;
    objects.bluetooth_scale_icon = 0;
    objects.flow_prediction_icon = 0;
    objects.weight_label = 0;
    objects.profile_info = 0;
    objects.obj9 = 0;
    objects.profile_select_button = 0;
    objects.profile_name = 0;
    objects.settings_button = 0;
    objects.adjustments = 0;
    objects.temp_container = 0;
    objects.target_temp = 0;
    objects.down_temp_button = 0;
    objects.up_temp_button = 0;
    objects.obj10 = 0;
    objects.brew_target_time_container = 0;
    objects.target_duration = 0;
    objects.obj11 = 0;
    objects.up_duration_button = 0;
    objects.down_duration_button = 0;
    objects.brew_target_weight_container = 0;
    objects.target_weight_1 = 0;
    objects.obj12 = 0;
    objects.up_weight_button = 0;
    objects.down_weight_button = 0;
    objects.remove_volumetric_button = 0;
    objects.obj13 = 0;
    objects.save_button = 0;
    objects.accept_button = 0;
    objects.save_as_new_button = 0;
    screen_brew_screen_state.dials1_state.scale = 0;
    screen_brew_screen_state.dials1_state.indicator = 0;
    screen_brew_screen_state.dials1_state.indicator1 = 0;
    screen_brew_screen_state.dials1_state.scale1 = 0;
    screen_brew_screen_state.dials1_state.indicator2 = 0;
    screen_brew_screen_state.dials1_state.indicator3 = 0;
    screen_brew_screen_state.dials1_state.scale2 = 0;
    screen_brew_screen_state.dials1_state.indicator4 = 0;
    screen_brew_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(1);
}

void tick_screen_brew_screen() {
    screen_brew_screen_state_t *state = &screen_brew_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 1);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 12, &state->dials1_state);
    {
        const char *new_val = evalTextProperty(flowState, 3, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj8);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj8;
            lv_label_set_text(objects.obj8, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 4, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.start_button, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.start_button;
            if (new_val) {
                lv_obj_add_flag(objects.start_button, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.start_button, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 6, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.mode_switch, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.mode_switch;
            if (new_val) {
                lv_obj_add_flag(objects.mode_switch, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.mode_switch, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 7, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.bluetooth_scale_icon, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.bluetooth_scale_icon;
            if (new_val) {
                lv_obj_add_flag(objects.bluetooth_scale_icon, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.bluetooth_scale_icon, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 8, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.flow_prediction_icon, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.flow_prediction_icon;
            if (new_val) {
                lv_obj_add_flag(objects.flow_prediction_icon, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.flow_prediction_icon, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 9, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.weight_label);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.weight_label;
            lv_label_set_text(objects.weight_label, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 10, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.profile_info, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.profile_info;
            if (new_val) {
                lv_obj_add_flag(objects.profile_info, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.profile_info, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 14, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.profile_name);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.profile_name;
            lv_label_set_text(objects.profile_name, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 16, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.adjustments, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.adjustments;
            if (new_val) {
                lv_obj_add_flag(objects.adjustments, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.adjustments, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 18, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_temp);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_temp;
            lv_label_set_text(objects.target_temp, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 22, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.brew_target_time_container, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.brew_target_time_container;
            if (new_val) {
                lv_obj_add_flag(objects.brew_target_time_container, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.brew_target_time_container, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 23, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_duration);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_duration;
            lv_label_set_text(objects.target_duration, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 27, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.brew_target_weight_container, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.brew_target_weight_container;
            if (new_val) {
                lv_obj_add_flag(objects.brew_target_weight_container, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.brew_target_weight_container, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 28, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_weight_1);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_weight_1;
            lv_label_set_text(objects.target_weight_1, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 33, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.obj13, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.obj13;
            if (new_val) {
                lv_obj_add_flag(objects.obj13, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.obj13, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 34, 3, "Failed to evaluate Disabled state");
        bool cur_val = lv_obj_has_state(objects.save_button, LV_STATE_DISABLED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.save_button;
            if (new_val) {
                lv_obj_add_state(objects.save_button, LV_STATE_DISABLED);
            } else {
                lv_obj_clear_state(objects.save_button, LV_STATE_DISABLED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 36, 3, "Failed to evaluate Disabled state");
        bool cur_val = lv_obj_has_state(objects.save_as_new_button, LV_STATE_DISABLED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.save_as_new_button;
            if (new_val) {
                lv_obj_add_state(objects.save_as_new_button, LV_STATE_DISABLED);
            } else {
                lv_obj_clear_state(objects.save_as_new_button, LV_STATE_DISABLED);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_status_screen() {
    screen_status_screen_state_t *state = &screen_status_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 2);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.status_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_status_screen_status_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj,
                      LV_OBJ_FLAG_CLICK_FOCUSABLE | LV_OBJ_FLAG_GESTURE_BUBBLE | LV_OBJ_FLAG_SNAPPABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj1 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 23, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                       LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // targetDuration_1
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.target_duration_1 = obj;
                    lv_obj_set_pos(obj, 80, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // targetWeight_2
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.target_weight_2 = obj;
                    lv_obj_set_pos(obj, 80, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // targetTemp_1
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.target_temp_1 = obj;
                    lv_obj_set_pos(obj, -40, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // Image7
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.image7 = obj;
                    lv_obj_set_pos(obj, -90, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_thermometer_half_40x40);
                    lv_img_set_zoom(obj, 200);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_images_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // Image8
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.image8 = obj;
                    lv_obj_set_pos(obj, 25, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_clock_40x40);
                    lv_img_set_zoom(obj, 200);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_images_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // Image9
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.image9 = obj;
                    lv_obj_set_pos(obj, 25, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_equality_40x40);
                    lv_img_set_zoom(obj, 150);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_images_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // pauseButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.pause_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_pause_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_status_screen_pause_button, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // checkButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.check_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_check_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_status_screen_check_button, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // currentDuration
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.current_duration = obj;
                    lv_obj_set_pos(obj, 0, 70);
                    lv_obj_set_size(obj, 320, 50);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_34, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // stepLabel
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.step_label = obj;
                    lv_obj_set_pos(obj, 0, -65);
                    lv_obj_set_size(obj, 200, 30);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][3]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_opa(obj, 408, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // phaseLabel
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.phase_label = obj;
                    lv_obj_set_pos(obj, 0, -40);
                    lv_obj_set_size(obj, 200, 30);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // barContainer
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.bar_container = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 320, 20);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // brewBar
                            lv_obj_t *obj = lv_bar_create(parent_obj);
                            objects.brew_bar = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 100, 10);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][3]),
                                                      LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 408, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_grow(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][2]),
                                                      LV_PART_INDICATOR | LV_STATE_DEFAULT);
                        }
                    }
                }
                {
                    // phaseProgress
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.phase_progress = obj;
                    lv_obj_set_pos(obj, 0, 20);
                    lv_obj_set_size(obj, 320, 20);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][3]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_opa(obj, 408, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_14, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_grow(obj, 4, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    // processVolume
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.process_volume = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 180, 30);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
            }
        }
    }

    tick_screen_status_screen();
}

void delete_screen_status_screen() {
    lv_obj_del(objects.status_screen);
    objects.status_screen = 0;
    objects.obj1 = 0;
    objects.target_duration_1 = 0;
    objects.target_weight_2 = 0;
    objects.target_temp_1 = 0;
    objects.image7 = 0;
    objects.image8 = 0;
    objects.image9 = 0;
    objects.pause_button = 0;
    objects.check_button = 0;
    objects.current_duration = 0;
    objects.step_label = 0;
    objects.phase_label = 0;
    objects.bar_container = 0;
    objects.brew_bar = 0;
    objects.phase_progress = 0;
    objects.process_volume = 0;
    screen_status_screen_state.dials1_state.scale = 0;
    screen_status_screen_state.dials1_state.indicator = 0;
    screen_status_screen_state.dials1_state.indicator1 = 0;
    screen_status_screen_state.dials1_state.scale1 = 0;
    screen_status_screen_state.dials1_state.indicator2 = 0;
    screen_status_screen_state.dials1_state.indicator3 = 0;
    screen_status_screen_state.dials1_state.scale2 = 0;
    screen_status_screen_state.dials1_state.indicator4 = 0;
    screen_status_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(2);
}

void tick_screen_status_screen() {
    screen_status_screen_state_t *state = &screen_status_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 2);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 23, &state->dials1_state);
    {
        const char *new_val = evalTextProperty(flowState, 3, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_duration_1);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_duration_1;
            lv_label_set_text(objects.target_duration_1, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 3, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.target_duration_1, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.target_duration_1;
            if (new_val) {
                lv_obj_add_flag(objects.target_duration_1, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.target_duration_1, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 4, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_weight_2);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_weight_2;
            lv_label_set_text(objects.target_weight_2, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 4, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.target_weight_2, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.target_weight_2;
            if (new_val) {
                lv_obj_add_flag(objects.target_weight_2, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.target_weight_2, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 5, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_temp_1);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_temp_1;
            lv_label_set_text(objects.target_temp_1, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 7, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.image8, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.image8;
            if (new_val) {
                lv_obj_add_flag(objects.image8, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.image8, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 8, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.image9, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.image9;
            if (new_val) {
                lv_obj_add_flag(objects.image9, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.image9, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 9, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.pause_button, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.pause_button;
            if (new_val) {
                lv_obj_add_flag(objects.pause_button, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.pause_button, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 10, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.check_button, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.check_button;
            if (new_val) {
                lv_obj_add_flag(objects.check_button, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.check_button, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 11, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.current_duration);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.current_duration;
            lv_label_set_text(objects.current_duration, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 12, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.step_label);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.step_label;
            lv_label_set_text(objects.step_label, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 13, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.phase_label);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.phase_label;
            lv_label_set_text(objects.phase_label, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 14, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.bar_container, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.bar_container;
            if (new_val) {
                lv_obj_add_flag(objects.bar_container, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.bar_container, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        int32_t new_val = evalIntegerProperty(flowState, 15, 3, "Failed to evaluate Value in Bar widget");
        int32_t cur_val = lv_bar_get_value(objects.brew_bar);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.brew_bar;
            lv_bar_set_value(objects.brew_bar, new_val, LV_ANIM_OFF);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 16, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.phase_progress);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.phase_progress;
            lv_label_set_text(objects.phase_progress, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 16, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.phase_progress, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.phase_progress;
            if (new_val) {
                lv_obj_add_flag(objects.phase_progress, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.phase_progress, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 17, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.process_volume);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.process_volume;
            lv_label_set_text(objects.process_volume, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 17, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.process_volume, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.process_volume;
            if (new_val) {
                lv_obj_add_flag(objects.process_volume, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.process_volume, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_menu_screen() {
    screen_menu_screen_state_t *state = &screen_menu_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 3);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.menu_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_menu_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj2 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 34, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW_WRAP, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_left(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // btnBrew
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_brew = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_btn_brew, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_mug_hot_alt_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnSteam
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_steam = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_btn_steam, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_wind_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnWater
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_water = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_btn_water, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_raindrops_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnGrind
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_grind = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_btn_grind, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_coffee_bean_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
    }

    tick_screen_menu_screen();
}

void delete_screen_menu_screen() {
    lv_obj_del(objects.menu_screen);
    objects.menu_screen = 0;
    objects.obj2 = 0;
    objects.btn_brew = 0;
    objects.btn_steam = 0;
    objects.btn_water = 0;
    objects.btn_grind = 0;
    screen_menu_screen_state.dials1_state.scale = 0;
    screen_menu_screen_state.dials1_state.indicator = 0;
    screen_menu_screen_state.dials1_state.indicator1 = 0;
    screen_menu_screen_state.dials1_state.scale1 = 0;
    screen_menu_screen_state.dials1_state.indicator2 = 0;
    screen_menu_screen_state.dials1_state.indicator3 = 0;
    screen_menu_screen_state.dials1_state.scale2 = 0;
    screen_menu_screen_state.dials1_state.indicator4 = 0;
    screen_menu_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(3);
}

void tick_screen_menu_screen() {
    screen_menu_screen_state_t *state = &screen_menu_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 3);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 34, &state->dials1_state);
    {
        bool new_val = evalBooleanProperty(flowState, 6, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.btn_grind, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.btn_grind;
            if (new_val) {
                lv_obj_add_flag(objects.btn_grind, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.btn_grind, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_steam_screen() {
    screen_steam_screen_state_t *state = &screen_steam_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 4);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.steam_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_steam_screen_steam_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj,
                      LV_OBJ_FLAG_CLICK_FOCUSABLE | LV_OBJ_FLAG_GESTURE_BUBBLE | LV_OBJ_FLAG_SNAPPABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj3 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 45, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                       LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_ANY | LV_STATE_DEFAULT);
            lv_obj_set_style_border_opa(obj, 0, LV_PART_ANY | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // mainLabel5
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.main_label5 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text_static(obj, "Steam");
                }
                {
                    // Image5_1
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.image5_1 = obj;
                    lv_obj_set_pos(obj, 0, -79);
                    lv_obj_set_size(obj, 40, 40);
                    lv_img_set_src(obj, &img_thermometer_half_40x40);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_images_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 360, 300);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // targetTemp2
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.target_temp2 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 90, 30);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "");
                        }
                        {
                            // steamDownTempButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.steam_down_temp_button = obj;
                            lv_obj_set_pos(obj, -90, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_steam_screen_steam_down_temp_button, LV_EVENT_ALL,
                                                flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // steamUpTempButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.steam_up_temp_button = obj;
                            lv_obj_set_pos(obj, 90, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_steam_screen_steam_up_temp_button, LV_EVENT_ALL, flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
                {
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.obj14 = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_wind_40x40);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
    }

    tick_screen_steam_screen();
}

void delete_screen_steam_screen() {
    lv_obj_del(objects.steam_screen);
    objects.steam_screen = 0;
    objects.obj3 = 0;
    objects.main_label5 = 0;
    objects.image5_1 = 0;
    objects.target_temp2 = 0;
    objects.steam_down_temp_button = 0;
    objects.steam_up_temp_button = 0;
    objects.obj14 = 0;
    screen_steam_screen_state.dials1_state.scale = 0;
    screen_steam_screen_state.dials1_state.indicator = 0;
    screen_steam_screen_state.dials1_state.indicator1 = 0;
    screen_steam_screen_state.dials1_state.scale1 = 0;
    screen_steam_screen_state.dials1_state.indicator2 = 0;
    screen_steam_screen_state.dials1_state.indicator3 = 0;
    screen_steam_screen_state.dials1_state.scale2 = 0;
    screen_steam_screen_state.dials1_state.indicator4 = 0;
    screen_steam_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(4);
}

void tick_screen_steam_screen() {
    screen_steam_screen_state_t *state = &screen_steam_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 4);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 45, &state->dials1_state);
    {
        const char *new_val = evalTextProperty(flowState, 6, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_temp2);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_temp2;
            lv_label_set_text(objects.target_temp2, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 9, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.obj14, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.obj14;
            if (new_val) {
                lv_obj_add_flag(objects.obj14, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.obj14, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_water_screen() {
    screen_water_screen_state_t *state = &screen_water_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 5);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.water_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_water_screen_water_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj,
                      LV_OBJ_FLAG_CLICK_FOCUSABLE | LV_OBJ_FLAG_GESTURE_BUBBLE | LV_OBJ_FLAG_SNAPPABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj4 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 56, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                       LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // mainLabel6
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.main_label6 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text_static(obj, "Water");
                }
                {
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 360, 360);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // waterDownTempButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.water_down_temp_button = obj;
                            lv_obj_set_pos(obj, -90, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_water_screen_water_down_temp_button, LV_EVENT_ALL,
                                                flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // targetTemp3
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.target_temp3 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 90, 30);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "");
                        }
                        {
                            // Image10
                            lv_obj_t *obj = lv_img_create(parent_obj);
                            objects.image10 = obj;
                            lv_obj_set_pos(obj, 0, -79);
                            lv_obj_set_size(obj, 40, 40);
                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_images_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // waterUpTempButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.water_up_temp_button = obj;
                            lv_obj_set_pos(obj, 90, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_water_screen_water_up_temp_button, LV_EVENT_ALL, flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
                {
                    // waterStartButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.water_start_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_CHECKED_RELEASED, NULL, &img_pause_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_water_screen_water_start_button, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
    }

    tick_screen_water_screen();
}

void delete_screen_water_screen() {
    lv_obj_del(objects.water_screen);
    objects.water_screen = 0;
    objects.obj4 = 0;
    objects.main_label6 = 0;
    objects.water_down_temp_button = 0;
    objects.target_temp3 = 0;
    objects.image10 = 0;
    objects.water_up_temp_button = 0;
    objects.water_start_button = 0;
    screen_water_screen_state.dials1_state.scale = 0;
    screen_water_screen_state.dials1_state.indicator = 0;
    screen_water_screen_state.dials1_state.indicator1 = 0;
    screen_water_screen_state.dials1_state.scale1 = 0;
    screen_water_screen_state.dials1_state.indicator2 = 0;
    screen_water_screen_state.dials1_state.indicator3 = 0;
    screen_water_screen_state.dials1_state.scale2 = 0;
    screen_water_screen_state.dials1_state.indicator4 = 0;
    screen_water_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(5);
}

void tick_screen_water_screen() {
    screen_water_screen_state_t *state = &screen_water_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 5);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 56, &state->dials1_state);
    {
        const char *new_val = evalTextProperty(flowState, 6, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_temp3);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_temp3;
            lv_label_set_text(objects.target_temp3, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 9, 3, "Failed to evaluate Checked state");
        bool cur_val = lv_obj_has_state(objects.water_start_button, LV_STATE_CHECKED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.water_start_button;
            if (new_val) {
                lv_obj_add_state(objects.water_start_button, LV_STATE_CHECKED);
            } else {
                lv_obj_clear_state(objects.water_start_button, LV_STATE_CHECKED);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_profile_screen() {
    screen_profile_screen_state_t *state = &screen_profile_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 6);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.profile_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_profile_screen_profile_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj5 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 67, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                       LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.obj15 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    lv_obj_set_pos(obj, 1, -15);
                    lv_obj_set_size(obj, 360, 197);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                               LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM |
                                               LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_AROUND, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // profileName_1
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.profile_name_1 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 340, 27);
                            lv_label_set_long_mode(obj, LV_LABEL_LONG_SCROLL_CIRCULAR);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR |
                                                       LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_ELASTIC |
                                                       LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "");
                        }
                        {
                            // profileTempTime
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.profile_temp_time = obj;
                            lv_obj_set_pos(obj, 0, -598);
                            lv_obj_set_size(obj, 300, 30);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR |
                                                       LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_ELASTIC |
                                                       LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, -2769, -6077);
                                    lv_obj_set_size(obj, 116, 44);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj16 = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj17 = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "");
                                        }
                                    }
                                }
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, -2769, -6077);
                                    lv_obj_set_size(obj, 116, 44);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj18 = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_clock_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj19 = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_equality_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj20 = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "");
                                        }
                                    }
                                }
                            }
                        }
                        {
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            lv_obj_set_pos(obj, 0, 2633);
                            lv_obj_set_size(obj, 300, 112);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.obj21 = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text(obj, "");
                                }
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.obj22 = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text(obj, "");
                                }
                            }
                        }
                    }
                }
                {
                    // selectProfile
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.select_profile = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_check_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_profile_screen_select_profile, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                               LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM |
                                               LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // previousProfile
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.previous_profile = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_left_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_profile_screen_previous_profile, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                               LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM |
                                               LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_LEFT_MID, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_opa(obj, 125, LV_PART_MAIN | LV_STATE_DISABLED);
                }
                {
                    // nextProfile
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.next_profile = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_right_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_profile_screen_next_profile, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                               LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM |
                                               LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_RIGHT_MID, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_opa(obj, 125, LV_PART_MAIN | LV_STATE_DISABLED);
                }
            }
        }
    }

    tick_screen_profile_screen();
}

void delete_screen_profile_screen() {
    lv_obj_del(objects.profile_screen);
    objects.profile_screen = 0;
    objects.obj5 = 0;
    objects.obj15 = 0;
    objects.profile_name_1 = 0;
    objects.profile_temp_time = 0;
    objects.obj16 = 0;
    objects.obj17 = 0;
    objects.obj18 = 0;
    objects.obj19 = 0;
    objects.obj20 = 0;
    objects.obj21 = 0;
    objects.obj22 = 0;
    objects.select_profile = 0;
    objects.previous_profile = 0;
    objects.next_profile = 0;
    screen_profile_screen_state.dials1_state.scale = 0;
    screen_profile_screen_state.dials1_state.indicator = 0;
    screen_profile_screen_state.dials1_state.indicator1 = 0;
    screen_profile_screen_state.dials1_state.scale1 = 0;
    screen_profile_screen_state.dials1_state.indicator2 = 0;
    screen_profile_screen_state.dials1_state.indicator3 = 0;
    screen_profile_screen_state.dials1_state.scale2 = 0;
    screen_profile_screen_state.dials1_state.indicator4 = 0;
    screen_profile_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(6);
}

void tick_screen_profile_screen() {
    screen_profile_screen_state_t *state = &screen_profile_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 6);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 67, &state->dials1_state);
    {
        const char *new_val = evalTextProperty(flowState, 3, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj15);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj15;
            lv_label_set_text(objects.obj15, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 5, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.profile_name_1);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.profile_name_1;
            lv_label_set_text(objects.profile_name_1, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 9, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj17);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj17;
            lv_label_set_text(objects.obj17, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 11, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.obj18, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.obj18;
            if (new_val) {
                lv_obj_add_flag(objects.obj18, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.obj18, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 12, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.obj19, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.obj19;
            if (new_val) {
                lv_obj_add_flag(objects.obj19, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.obj19, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 13, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj20);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj20;
            lv_label_set_text(objects.obj20, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 15, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj21);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj21;
            lv_label_set_text(objects.obj21, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 16, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj22);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj22;
            lv_label_set_text(objects.obj22, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 18, 3, "Failed to evaluate Disabled state");
        bool cur_val = lv_obj_has_state(objects.previous_profile, LV_STATE_DISABLED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.previous_profile;
            if (new_val) {
                lv_obj_add_state(objects.previous_profile, LV_STATE_DISABLED);
            } else {
                lv_obj_clear_state(objects.previous_profile, LV_STATE_DISABLED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 19, 3, "Failed to evaluate Disabled state");
        bool cur_val = lv_obj_has_state(objects.next_profile, LV_STATE_DISABLED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.next_profile;
            if (new_val) {
                lv_obj_add_state(objects.next_profile, LV_STATE_DISABLED);
            } else {
                lv_obj_clear_state(objects.next_profile, LV_STATE_DISABLED);
            }
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_grind_screen() {
    screen_grind_screen_state_t *state = &screen_grind_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 7);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.grind_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_grind_screen, LV_EVENT_ALL, flowState);
    lv_obj_clear_flag(obj,
                      LV_OBJ_FLAG_CLICK_FOCUSABLE | LV_OBJ_FLAG_GESTURE_BUBBLE | LV_OBJ_FLAG_SNAPPABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                              LV_PART_MAIN | LV_STATE_CHECKED);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj6 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            create_user_widget_dials(obj, getFlowState(flowState, 0), 78, &state->dials1_state);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER |
                                       LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 8);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // mainLabel4
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.main_label4 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text_static(obj, "Grind");
                }
                {
                    // grindStartButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.grind_start_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_CHECKED_RELEASED, NULL, &img_pause_40x40, NULL);
                    lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_grind_start_button, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // modeSwitch1
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.mode_switch1 = obj;
                    lv_obj_set_pos(obj, -1, -80);
                    lv_obj_set_size(obj, 160, 50);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_mode_switch1, LV_EVENT_ALL, flowState);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                              LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_side(obj, LV_BORDER_SIDE_FULL, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 2, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                              LV_PART_MAIN | LV_STATE_CHECKED);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.obj23 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 40);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_equality_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_obj23, LV_EVENT_ALL, flowState);
                            lv_obj_set_style_align(obj, LV_ALIGN_LEFT_MID, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                         LV_PART_MAIN | LV_STATE_CHECKED);
                        }
                        {
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.obj24 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                            lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_obj24, LV_EVENT_ALL, flowState);
                            lv_obj_set_style_align(obj, LV_ALIGN_RIGHT_MID, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                        LV_PART_MAIN | LV_STATE_CHECKED);
                            lv_label_set_text(obj, "");
                        }
                    }
                }
                {
                    // targetWeight
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.target_weight = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 300, 50);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // targetDuration3_1
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.target_duration3_1 = obj;
                            lv_obj_set_pos(obj, 30, 0);
                            lv_obj_set_size(obj, 90, 30);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "");
                        }
                        {
                            // targetSymbol_1
                            lv_obj_t *obj = lv_img_create(parent_obj);
                            objects.target_symbol_1 = obj;
                            lv_obj_set_pos(obj, -120, 0);
                            lv_obj_set_size(obj, 40, 40);
                            lv_img_set_src(obj, &img_equality_40x40);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_images_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // grindDownWeightButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.grind_down_weight_button = obj;
                            lv_obj_set_pos(obj, -60, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_grind_down_weight_button, LV_EVENT_ALL,
                                                flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // grindUpWeightButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.grind_up_weight_button = obj;
                            lv_obj_set_pos(obj, 120, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_grind_up_weight_button, LV_EVENT_ALL,
                                                flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
                {
                    // targetTime
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.target_time = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 300, 50);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // targetDuration3
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.target_duration3 = obj;
                            lv_obj_set_pos(obj, 30, 0);
                            lv_obj_set_size(obj, 90, 30);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "");
                        }
                        {
                            // targetSymbol
                            lv_obj_t *obj = lv_img_create(parent_obj);
                            objects.target_symbol = obj;
                            lv_obj_set_pos(obj, -120, 0);
                            lv_obj_set_size(obj, 40, 40);
                            lv_img_set_src(obj, &img_clock_40x40);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_images_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // grindDownDurationButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.grind_down_duration_button = obj;
                            lv_obj_set_pos(obj, -60, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_grind_down_duration_button, LV_EVENT_ALL,
                                                flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // grindUpDurationButton
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.grind_up_duration_button = obj;
                            lv_obj_set_pos(obj, 120, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, event_handler_cb_grind_screen_grind_up_duration_button, LV_EVENT_ALL,
                                                flowState);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                         LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
            }
        }
    }

    tick_screen_grind_screen();
}

void delete_screen_grind_screen() {
    lv_obj_del(objects.grind_screen);
    objects.grind_screen = 0;
    objects.obj6 = 0;
    objects.main_label4 = 0;
    objects.grind_start_button = 0;
    objects.mode_switch1 = 0;
    objects.obj23 = 0;
    objects.obj24 = 0;
    objects.target_weight = 0;
    objects.target_duration3_1 = 0;
    objects.target_symbol_1 = 0;
    objects.grind_down_weight_button = 0;
    objects.grind_up_weight_button = 0;
    objects.target_time = 0;
    objects.target_duration3 = 0;
    objects.target_symbol = 0;
    objects.grind_down_duration_button = 0;
    objects.grind_up_duration_button = 0;
    screen_grind_screen_state.dials1_state.scale = 0;
    screen_grind_screen_state.dials1_state.indicator = 0;
    screen_grind_screen_state.dials1_state.indicator1 = 0;
    screen_grind_screen_state.dials1_state.scale1 = 0;
    screen_grind_screen_state.dials1_state.indicator2 = 0;
    screen_grind_screen_state.dials1_state.indicator3 = 0;
    screen_grind_screen_state.dials1_state.scale2 = 0;
    screen_grind_screen_state.dials1_state.indicator4 = 0;
    screen_grind_screen_state.dials1_state.indicator5 = 0;
    deletePageFlowState(7);
}

void tick_screen_grind_screen() {
    screen_grind_screen_state_t *state = &screen_grind_screen_state;
    (void)state;
    void *flowState = getFlowState(0, 7);
    (void)flowState;
    tick_user_widget_dials(getFlowState(flowState, 0), 78, &state->dials1_state);
    {
        bool new_val = evalBooleanProperty(flowState, 4, 3, "Failed to evaluate Checked state");
        bool cur_val = lv_obj_has_state(objects.grind_start_button, LV_STATE_CHECKED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.grind_start_button;
            if (new_val) {
                lv_obj_add_state(objects.grind_start_button, LV_STATE_CHECKED);
            } else {
                lv_obj_clear_state(objects.grind_start_button, LV_STATE_CHECKED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 5, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.mode_switch1, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.mode_switch1;
            if (new_val) {
                lv_obj_add_flag(objects.mode_switch1, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.mode_switch1, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 5, 4, "Failed to evaluate Checked state");
        bool cur_val = lv_obj_has_state(objects.mode_switch1, LV_STATE_CHECKED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.mode_switch1;
            if (new_val) {
                lv_obj_add_state(objects.mode_switch1, LV_STATE_CHECKED);
            } else {
                lv_obj_clear_state(objects.mode_switch1, LV_STATE_CHECKED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 6, 3, "Failed to evaluate Checked state");
        bool cur_val = lv_obj_has_state(objects.obj23, LV_STATE_CHECKED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.obj23;
            if (new_val) {
                lv_obj_add_state(objects.obj23, LV_STATE_CHECKED);
            } else {
                lv_obj_clear_state(objects.obj23, LV_STATE_CHECKED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 7, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj24);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj24;
            lv_label_set_text(objects.obj24, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 7, 3, "Failed to evaluate Checked state");
        bool cur_val = lv_obj_has_state(objects.obj24, LV_STATE_CHECKED);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.obj24;
            if (new_val) {
                lv_obj_add_state(objects.obj24, LV_STATE_CHECKED);
            } else {
                lv_obj_clear_state(objects.obj24, LV_STATE_CHECKED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 8, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.target_weight, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.target_weight;
            if (new_val) {
                lv_obj_add_flag(objects.target_weight, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.target_weight, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 9, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_duration3_1);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_duration3_1;
            lv_label_set_text(objects.target_duration3_1, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 13, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.target_time, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.target_time;
            if (new_val) {
                lv_obj_add_flag(objects.target_time, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.target_time, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 14, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.target_duration3);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.target_duration3;
            lv_label_set_text(objects.target_duration3, new_val);
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_info_screen() {
    void *flowState = getFlowState(0, 8);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.info_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_info_screen_info_screen, LV_EVENT_ALL, flowState);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_qrcode_create(parent_obj, 160, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                             lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]));
            lv_obj_set_pos(obj, 0, 80);
            lv_obj_set_size(obj, 160, 160);
            lv_qrcode_update(obj, "https://shop.gaggimate.eu/", 26);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // standbyIcons_1
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.standby_icons_1 = obj;
            lv_obj_set_pos(obj, 0, -210);
            lv_obj_set_size(obj, 300, 20);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // wifiIcon_1
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.wifi_icon_1 = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_wifi_20x20);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // bluetoothIcon_1
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.bluetooth_icon_1 = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_bluetooth_alt_20x20);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // updateIcon_1
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.update_icon_1 = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_refresh_20x20);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                  LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj25 = obj;
            lv_obj_set_pos(obj, 0, -23);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_letter_space(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj26 = obj;
            lv_obj_set_pos(obj, 0, -160);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text_static(obj, "Controller Version");
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj27 = obj;
            lv_obj_set_pos(obj, 0, -130);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text_static(obj, "v1.7.0");
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj28 = obj;
            lv_obj_set_pos(obj, 0, -100);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text_static(obj, "Display Version");
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj29 = obj;
            lv_obj_set_pos(obj, 0, -70);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text_static(obj, "v1.6.1");
        }
        {
            // updateIcon_2
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.update_icon_2 = obj;
            lv_obj_set_pos(obj, 40, -130);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_refresh_20x20);
            lv_img_set_zoom(obj, 200);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][2]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // updateIcon_3
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.update_icon_3 = obj;
            lv_obj_set_pos(obj, 41, -69);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_refresh_20x20);
            lv_img_set_zoom(obj, 200);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][2]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // menuIcon_2
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.menu_icon_2 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_angle_up_40x40);
            lv_obj_add_event_cb(obj, event_handler_cb_info_screen_menu_icon_2, LV_EVENT_ALL, flowState);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    }

    tick_screen_info_screen();
}

void delete_screen_info_screen() {
    lv_obj_del(objects.info_screen);
    objects.info_screen = 0;
    objects.standby_icons_1 = 0;
    objects.wifi_icon_1 = 0;
    objects.bluetooth_icon_1 = 0;
    objects.update_icon_1 = 0;
    objects.obj25 = 0;
    objects.obj26 = 0;
    objects.obj27 = 0;
    objects.obj28 = 0;
    objects.obj29 = 0;
    objects.update_icon_2 = 0;
    objects.update_icon_3 = 0;
    objects.menu_icon_2 = 0;
    deletePageFlowState(8);
}

void tick_screen_info_screen() {
    void *flowState = getFlowState(0, 8);
    (void)flowState;
    {
        bool new_val = evalBooleanProperty(flowState, 3, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.wifi_icon_1, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.wifi_icon_1;
            if (new_val) {
                lv_obj_add_flag(objects.wifi_icon_1, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.wifi_icon_1, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 4, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.bluetooth_icon_1, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.bluetooth_icon_1;
            if (new_val) {
                lv_obj_add_flag(objects.bluetooth_icon_1, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.bluetooth_icon_1, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 5, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(objects.update_icon_1, LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = objects.update_icon_1;
            if (new_val) {
                lv_obj_add_flag(objects.update_icon_1, LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(objects.update_icon_1, LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 6, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj25);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj25;
            lv_label_set_text(objects.obj25, new_val);
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_new_profile_screen() {
    void *flowState = getFlowState(0, 9);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.new_profile_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_new_profile_screen_new_profile_screen, LV_EVENT_ALL, flowState);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj30 = obj;
            lv_obj_set_pos(obj, 0, -210);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text_static(obj, "Select profile");
        }
        {
            // singleView
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.single_view = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // prevButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.prev_button = obj;
                    lv_obj_set_pos(obj, -200, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_left_40x40, NULL);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.obj31 = obj;
                    lv_obj_set_pos(obj, 0, 172);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_label_set_long_mode(obj, LV_LABEL_LONG_SCROLL);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text_static(obj, "Soup Pro Beta");
                }
                {
                    // phasePreview
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.phase_preview = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 480, 480);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.obj32 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 300);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_clip_corner(obj, true, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                      LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                          LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    objects.obj33 = obj;
                                    lv_obj_set_pos(obj, -115, -110);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_img_set_src(obj, &img_thermometer_half_40x40);
                                    lv_img_set_zoom(obj, 150);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.obj34 = obj;
                                    lv_obj_set_pos(obj, -53, -110);
                                    lv_obj_set_size(obj, 85, LV_SIZE_CONTENT);
                                    lv_label_set_long_mode(obj, LV_LABEL_LONG_SCROLL);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text_static(obj, "93°C");
                                }
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    objects.obj35 = obj;
                                    lv_obj_set_pos(obj, 10, -110);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_img_set_src(obj, &img_clock_40x40);
                                    lv_img_set_zoom(obj, 150);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.obj36 = obj;
                                    lv_obj_set_pos(obj, 72, -110);
                                    lv_obj_set_size(obj, 85, LV_SIZE_CONTENT);
                                    lv_label_set_long_mode(obj, LV_LABEL_LONG_SCROLL);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text_static(obj, "1:15");
                                }
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.obj37 = obj;
                                    lv_obj_set_pos(obj, 0, -75);
                                    lv_obj_set_size(obj, 250, LV_SIZE_CONTENT);
                                    lv_label_set_long_mode(obj, LV_LABEL_LONG_SCROLL);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text_static(obj, "2 Phases - 3 Steps");
                                }
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    lv_obj_set_pos(obj, 1, 49);
                                    lv_obj_set_size(obj, 260, 170);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                            }
                        }
                        {
                            lv_obj_t *obj = lv_btn_create(parent_obj);
                            objects.obj38 = obj;
                            lv_obj_set_pos(obj, 140, -140);
                            lv_obj_set_size(obj, 30, 30);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                      LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text_static(obj, "x");
                                }
                            }
                        }
                    }
                }
                {
                    // imagePreview
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.image_preview = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 480, 480);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // profilePreview
                            lv_obj_t *obj = lv_img_create(parent_obj);
                            objects.profile_preview = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 300);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_clip_corner(obj, true, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            lv_obj_t *obj = lv_btn_create(parent_obj);
                            objects.obj39 = obj;
                            lv_obj_set_pos(obj, 140, -140);
                            lv_obj_set_size(obj, 30, 30);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                      LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text_static(obj, "i");
                                }
                            }
                        }
                    }
                }
                {
                    // selectButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.select_button = obj;
                    lv_obj_set_pos(obj, 0, 210);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_check_40x40, NULL);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // nextButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.next_button = obj;
                    lv_obj_set_pos(obj, 200, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_right_40x40, NULL);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
        {
            // listView
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.list_view = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.obj40 = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 330, 300);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                              LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_left(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_row(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_column(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 80);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 80, 80);
                                    lv_img_set_zoom(obj, 255);
                                    lv_obj_set_style_radius(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_clip_corner(obj, true, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_side(obj, LV_BORDER_SIDE_FULL, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, 90, 0);
                                    lv_obj_set_size(obj, 180, 80);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj41 = obj;
                                            lv_obj_set_pos(obj, 0, -20);
                                            lv_obj_set_size(obj, 180, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "Soup Pro Beta");
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj42 = obj;
                                            lv_obj_set_pos(obj, -75, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj43 = obj;
                                            lv_obj_set_pos(obj, 0, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_clock_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj44 = obj;
                                            lv_obj_set_pos(obj, -39, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "93°C");
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj45 = obj;
                                            lv_obj_set_pos(obj, 40, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "0:35");
                                        }
                                    }
                                }
                                {
                                    lv_obj_t *obj = lv_btn_create(parent_obj);
                                    objects.obj46 = obj;
                                    lv_obj_set_pos(obj, 135, 0);
                                    lv_obj_set_size(obj, 30, 30);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_color(obj,
                                                              lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                              LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "i");
                                        }
                                    }
                                }
                            }
                        }
                        {
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 80);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 80, 80);
                                    lv_img_set_zoom(obj, 255);
                                    lv_obj_set_style_radius(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_clip_corner(obj, true, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, 90, 0);
                                    lv_obj_set_size(obj, 180, 80);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj47 = obj;
                                            lv_obj_set_pos(obj, 0, -20);
                                            lv_obj_set_size(obj, 180, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "Soup Pro Beta");
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj48 = obj;
                                            lv_obj_set_pos(obj, -75, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj49 = obj;
                                            lv_obj_set_pos(obj, 0, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_clock_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj50 = obj;
                                            lv_obj_set_pos(obj, -39, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "93°C");
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj51 = obj;
                                            lv_obj_set_pos(obj, 40, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "0:35");
                                        }
                                    }
                                }
                                {
                                    lv_obj_t *obj = lv_btn_create(parent_obj);
                                    objects.obj52 = obj;
                                    lv_obj_set_pos(obj, 135, 0);
                                    lv_obj_set_size(obj, 30, 30);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_color(obj,
                                                              lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                              LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "i");
                                        }
                                    }
                                }
                            }
                        }
                        {
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 80);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 80, 80);
                                    lv_img_set_zoom(obj, 255);
                                    lv_obj_set_style_radius(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_clip_corner(obj, true, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, 90, 0);
                                    lv_obj_set_size(obj, 180, 80);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj53 = obj;
                                            lv_obj_set_pos(obj, 0, -20);
                                            lv_obj_set_size(obj, 180, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "Soup Pro Beta");
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj54 = obj;
                                            lv_obj_set_pos(obj, -75, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj55 = obj;
                                            lv_obj_set_pos(obj, 0, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_clock_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj56 = obj;
                                            lv_obj_set_pos(obj, -39, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "93°C");
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj57 = obj;
                                            lv_obj_set_pos(obj, 40, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "0:35");
                                        }
                                    }
                                }
                                {
                                    lv_obj_t *obj = lv_btn_create(parent_obj);
                                    objects.obj58 = obj;
                                    lv_obj_set_pos(obj, 135, 0);
                                    lv_obj_set_size(obj, 30, 30);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_color(obj,
                                                              lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                              LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "i");
                                        }
                                    }
                                }
                            }
                        }
                        {
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 80);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_ITEMS | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 80, 80);
                                    lv_img_set_zoom(obj, 255);
                                    lv_obj_set_style_radius(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_clip_corner(obj, true, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    lv_obj_set_pos(obj, 90, 0);
                                    lv_obj_set_size(obj, 180, 80);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj59 = obj;
                                            lv_obj_set_pos(obj, 0, -20);
                                            lv_obj_set_size(obj, 180, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "Soup Pro Beta");
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj60 = obj;
                                            lv_obj_set_pos(obj, -75, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_img_create(parent_obj);
                                            objects.obj61 = obj;
                                            lv_obj_set_pos(obj, 0, 20);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_img_set_src(obj, &img_clock_40x40);
                                            lv_img_set_zoom(obj, 120);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj62 = obj;
                                            lv_obj_set_pos(obj, -39, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "93°C");
                                        }
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.obj63 = obj;
                                            lv_obj_set_pos(obj, 40, 20);
                                            lv_obj_set_size(obj, 40, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(
                                                obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_16,
                                                                       LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "0:35");
                                        }
                                    }
                                }
                                {
                                    lv_obj_t *obj = lv_btn_create(parent_obj);
                                    objects.obj64 = obj;
                                    lv_obj_set_pos(obj, 135, 0);
                                    lv_obj_set_size(obj, 30, 30);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 15, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_color(obj,
                                                              lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                              LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_color(
                                        obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text_static(obj, "i");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        {
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.obj65 = obj;
            lv_obj_set_pos(obj, -25, -175);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, 32);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_gallery, NULL);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.obj66 = obj;
            lv_obj_set_pos(obj, 25, -175);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, 32);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_list, NULL);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 100, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    }

    tick_screen_new_profile_screen();
}

void delete_screen_new_profile_screen() {
    lv_obj_del(objects.new_profile_screen);
    objects.new_profile_screen = 0;
    objects.obj30 = 0;
    objects.single_view = 0;
    objects.prev_button = 0;
    objects.obj31 = 0;
    objects.phase_preview = 0;
    objects.obj32 = 0;
    objects.obj33 = 0;
    objects.obj34 = 0;
    objects.obj35 = 0;
    objects.obj36 = 0;
    objects.obj37 = 0;
    objects.obj38 = 0;
    objects.image_preview = 0;
    objects.profile_preview = 0;
    objects.obj39 = 0;
    objects.select_button = 0;
    objects.next_button = 0;
    objects.list_view = 0;
    objects.obj40 = 0;
    objects.obj41 = 0;
    objects.obj42 = 0;
    objects.obj43 = 0;
    objects.obj44 = 0;
    objects.obj45 = 0;
    objects.obj46 = 0;
    objects.obj47 = 0;
    objects.obj48 = 0;
    objects.obj49 = 0;
    objects.obj50 = 0;
    objects.obj51 = 0;
    objects.obj52 = 0;
    objects.obj53 = 0;
    objects.obj54 = 0;
    objects.obj55 = 0;
    objects.obj56 = 0;
    objects.obj57 = 0;
    objects.obj58 = 0;
    objects.obj59 = 0;
    objects.obj60 = 0;
    objects.obj61 = 0;
    objects.obj62 = 0;
    objects.obj63 = 0;
    objects.obj64 = 0;
    objects.obj65 = 0;
    objects.obj66 = 0;
    deletePageFlowState(9);
}

void tick_screen_new_profile_screen() {
    void *flowState = getFlowState(0, 9);
    (void)flowState;
}

void create_screen_menu_screen_1() {
    void *flowState = getFlowState(0, 10);
    (void)flowState;
    lv_obj_t *obj = lv_obj_create(0);
    objects.menu_screen_1 = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_menu_screen_1, LV_EVENT_ALL, flowState);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]),
                              LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_CHAIN_HOR);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_left(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // btnBrew_1
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_brew_1 = obj;
                    lv_obj_set_pos(obj, 0, -170);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_btn_brew_1, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_mug_hot_alt_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnSteam_1
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_steam_1 = obj;
                    lv_obj_set_pos(obj, 147, -85);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_btn_steam_1, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_wind_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnWater_1
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_water_1 = obj;
                    lv_obj_set_pos(obj, 147, 85);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_btn_water_1, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_raindrops_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnGrind_1
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_grind_1 = obj;
                    lv_obj_set_pos(obj, 0, 170);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_btn_grind_1, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_coffee_bean_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnSettings_1
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_settings_1 = obj;
                    lv_obj_set_pos(obj, -147, 85);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_btn_settings_1, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_settings_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnInfo_1
                    lv_obj_t *obj = lv_btn_create(parent_obj);
                    objects.btn_info_1 = obj;
                    lv_obj_set_pos(obj, -147, -85);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_btn_info_1, LV_EVENT_ALL, flowState);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_info_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                    LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_shadow_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
        {
            // standbyButton
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.standby_button = obj;
            lv_obj_set_pos(obj, 0, 50);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_power_40x40);
            lv_obj_add_event_cb(obj, event_handler_cb_menu_screen_1_standby_button, LV_EVENT_ALL, flowState);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj67 = obj;
            lv_obj_set_pos(obj, 0, -50);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text_static(obj, "BREW");
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 240, 50);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_SCROLLBAR | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_AROUND, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.obj68 = obj;
                    lv_obj_set_pos(obj, -80, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_thermometer_half_40x40);
                    lv_img_set_zoom(obj, 120);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][6]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.obj69 = obj;
                    lv_obj_set_pos(obj, 0, -52);
                    lv_obj_set_size(obj, 65, LV_SIZE_CONTENT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
                {
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.obj70 = obj;
                    lv_obj_set_pos(obj, 40, 0);
                    lv_obj_set_size(obj, 40, 40);
                    lv_img_set_src(obj, &img_tachometer_fast_40x40);
                    lv_img_set_zoom(obj, 120);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][7]),
                                                 LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.obj71 = obj;
                    lv_obj_set_pos(obj, 0, -52);
                    lv_obj_set_size(obj, 65, LV_SIZE_CONTENT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                                LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_16, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "");
                }
            }
        }
    }

    tick_screen_menu_screen_1();
}

void delete_screen_menu_screen_1() {
    lv_obj_del(objects.menu_screen_1);
    objects.menu_screen_1 = 0;
    objects.btn_brew_1 = 0;
    objects.btn_steam_1 = 0;
    objects.btn_water_1 = 0;
    objects.btn_grind_1 = 0;
    objects.btn_settings_1 = 0;
    objects.btn_info_1 = 0;
    objects.standby_button = 0;
    objects.obj67 = 0;
    objects.obj68 = 0;
    objects.obj69 = 0;
    objects.obj70 = 0;
    objects.obj71 = 0;
    deletePageFlowState(10);
}

void tick_screen_menu_screen_1() {
    void *flowState = getFlowState(0, 10);
    (void)flowState;
    {
        const char *new_val = evalTextProperty(flowState, 12, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj69);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj69;
            lv_label_set_text(objects.obj69, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 14, 3, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(objects.obj71);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj71;
            lv_label_set_text(objects.obj71, new_val);
            tick_value_change_obj = NULL;
        }
    }
}

void create_user_widget_dials(lv_obj_t *parent_obj, void *flowState, int startWidgetIndex, user_widget_dials_state_t *state) {
    (void)flowState;
    (void)startWidgetIndex;
    (void)state;
    lv_obj_t *obj = parent_obj;
    {
        lv_obj_t *parent_obj = obj;
        {
            // tempGauge
            lv_obj_t *obj = lv_meter_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 0] = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 500, 500);
            {
                lv_meter_scale_t *scale = lv_meter_add_scale(obj);
                state->scale = scale;
                lv_meter_set_scale_ticks(obj, scale, 25, 10, 25,
                                         lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][5]));
                lv_meter_set_scale_major_ticks(obj, scale, 0, 0, 0, lv_color_hex(0x000000), 0);
                lv_meter_set_scale_range(obj, scale, 0, 160, 120, 120);
                {
                    state->indicator = lv_meter_add_needle_img(obj, scale, &img_indicator_small, -233, 0);
                }
                {
                    lv_meter_indicator_t *indicator =
                        lv_meter_add_scale_lines(obj, scale, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][6]),
                                                 lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][6]), false, 0);
                    state->indicator1 = indicator;
                    lv_meter_set_indicator_start_value(obj, indicator, 0);
                }
            }
            lv_obj_add_event_cb(obj, event_handler_cb_dials_temp_gauge, LV_EVENT_ALL, flowState);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_OFF);
            lv_obj_set_scroll_dir(obj, LV_DIR_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_opa(obj, 0, LV_PART_INDICATOR | LV_STATE_DEFAULT);
        }
        {
            // tempGaugeFull
            lv_obj_t *obj = lv_meter_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 1] = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 500, 500);
            {
                lv_meter_scale_t *scale = lv_meter_add_scale(obj);
                state->scale1 = scale;
                lv_meter_set_scale_ticks(obj, scale, 62, 10, 25,
                                         lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][5]));
                lv_meter_set_scale_major_ticks(obj, scale, 0, 0, 0, lv_color_hex(0x000000), 0);
                lv_meter_set_scale_range(obj, scale, 0, 160, 300, 120);
                {
                    state->indicator2 = lv_meter_add_needle_img(obj, scale, &img_indicator_small, -233, 0);
                }
                {
                    lv_meter_indicator_t *indicator =
                        lv_meter_add_scale_lines(obj, scale, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][6]),
                                                 lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][6]), false, 0);
                    state->indicator3 = indicator;
                    lv_meter_set_indicator_start_value(obj, indicator, 0);
                }
            }
            lv_obj_add_event_cb(obj, event_handler_cb_dials_temp_gauge_full, LV_EVENT_ALL, flowState);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_opa(obj, 0, LV_PART_INDICATOR | LV_STATE_DEFAULT);
        }
        {
            // pressureGauge
            lv_obj_t *obj = lv_meter_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 2] = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 500, 500);
            {
                lv_meter_scale_t *scale = lv_meter_add_scale(obj);
                state->scale2 = scale;
                lv_meter_set_scale_ticks(obj, scale, 25, 10, 25,
                                         lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][5]));
                lv_meter_set_scale_major_ticks(obj, scale, 0, 0, 0, lv_color_hex(0x000000), 0);
                lv_meter_set_scale_range(obj, scale, 160, 0, 120, 300);
                {
                    state->indicator4 = lv_meter_add_needle_img(obj, scale, &img_indicator_small, -233, 0);
                }
                {
                    lv_meter_indicator_t *indicator =
                        lv_meter_add_scale_lines(obj, scale, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][7]),
                                                 lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][7]), false, 0);
                    state->indicator5 = indicator;
                    lv_meter_set_indicator_start_value(obj, indicator, 0);
                }
            }
            lv_obj_add_event_cb(obj, event_handler_cb_dials_pressure_gauge, LV_EVENT_ALL, flowState);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_OFF);
            lv_obj_set_scroll_dir(obj, LV_DIR_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_opa(obj, 0, LV_PART_INDICATOR | LV_STATE_DEFAULT);
        }
        {
            // standbyIcon
            lv_obj_t *obj = lv_img_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 3] = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_power_40x40);
            lv_obj_add_event_cb(obj, event_handler_cb_dials_standby_icon, LV_EVENT_ALL, flowState);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // menuIcon
            lv_obj_t *obj = lv_img_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 4] = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_angle_up_40x40);
            lv_obj_add_event_cb(obj, event_handler_cb_dials_menu_icon, LV_EVENT_ALL, flowState);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // tempIcon
            lv_obj_t *obj = lv_img_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 5] = obj;
            lv_obj_set_pos(obj, -85, 200);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_thermometer_half_40x40);
            lv_img_set_zoom(obj, 150);
            lv_obj_add_event_cb(obj, event_handler_cb_dials_temp_icon, LV_EVENT_ALL, flowState);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][6]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][2]),
                                         LV_PART_MAIN | LV_STATE_CHECKED);
            lv_obj_set_style_img_opa(obj, 125, LV_PART_MAIN | LV_STATE_DISABLED);
        }
        {
            // pressureIcon
            lv_obj_t *obj = lv_img_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 6] = obj;
            lv_obj_set_pos(obj, 85, 200);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_tachometer_fast_40x40);
            lv_img_set_zoom(obj, 150);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][7]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // pressureText
            lv_obj_t *obj = lv_label_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 7] = obj;
            lv_obj_set_pos(obj, 50, -205);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
        {
            // tempText
            lv_obj_t *obj = lv_label_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 8] = obj;
            lv_obj_set_pos(obj, -50, -205);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
        {
            // tempTextFull
            lv_obj_t *obj = lv_label_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 9] = obj;
            lv_obj_set_pos(obj, 70, 205);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
    }
}

void tick_user_widget_dials(void *flowState, int startWidgetIndex, user_widget_dials_state_t *state) {
    (void)flowState;
    (void)startWidgetIndex;
    (void)state;
    {
        if (state->indicator) {
            int32_t new_val = evalIntegerProperty(flowState, 1, 4, "Failed to evaluate Value in Meter widget");
            int32_t cur_val = state->indicator->start_value;
            if (new_val != cur_val) {
                tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 0];
                lv_meter_set_indicator_value(((lv_obj_t **)&objects)[startWidgetIndex + 0], state->indicator, new_val);
                tick_value_change_obj = NULL;
            }
        }
    }
    {
        if (state->indicator1) {
            int32_t new_val = evalIntegerProperty(flowState, 1, 5, "Failed to evaluate End value in Meter widget");
            int32_t cur_val = state->indicator1->end_value;
            if (new_val != cur_val) {
                tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 0];
                lv_meter_set_indicator_end_value(((lv_obj_t **)&objects)[startWidgetIndex + 0], state->indicator1, new_val);
                tick_value_change_obj = NULL;
            }
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 1, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 0], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 0];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 0], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 0], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        if (state->indicator2) {
            int32_t new_val = evalIntegerProperty(flowState, 0, 4, "Failed to evaluate Value in Meter widget");
            int32_t cur_val = state->indicator2->start_value;
            if (new_val != cur_val) {
                tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 1];
                lv_meter_set_indicator_value(((lv_obj_t **)&objects)[startWidgetIndex + 1], state->indicator2, new_val);
                tick_value_change_obj = NULL;
            }
        }
    }
    {
        if (state->indicator3) {
            int32_t new_val = evalIntegerProperty(flowState, 0, 5, "Failed to evaluate End value in Meter widget");
            int32_t cur_val = state->indicator3->end_value;
            if (new_val != cur_val) {
                tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 1];
                lv_meter_set_indicator_end_value(((lv_obj_t **)&objects)[startWidgetIndex + 1], state->indicator3, new_val);
                tick_value_change_obj = NULL;
            }
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 0, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 1], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 1];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 1], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 1], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        if (state->indicator4) {
            int32_t new_val = evalIntegerProperty(flowState, 2, 4, "Failed to evaluate Value in Meter widget");
            int32_t cur_val = state->indicator4->start_value;
            if (new_val != cur_val) {
                tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 2];
                lv_meter_set_indicator_value(((lv_obj_t **)&objects)[startWidgetIndex + 2], state->indicator4, new_val);
                tick_value_change_obj = NULL;
            }
        }
    }
    {
        if (state->indicator5) {
            int32_t new_val = evalIntegerProperty(flowState, 2, 5, "Failed to evaluate End value in Meter widget");
            int32_t cur_val = state->indicator5->end_value;
            if (new_val != cur_val) {
                tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 2];
                lv_meter_set_indicator_end_value(((lv_obj_t **)&objects)[startWidgetIndex + 2], state->indicator5, new_val);
                tick_value_change_obj = NULL;
            }
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 2, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 2], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 2];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 2], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 2], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 3, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 3], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 3];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 3], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 3], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 4, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 4], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 4];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 4], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 4], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 5, 3, "Failed to evaluate Checked state");
        bool cur_val = lv_obj_has_state(((lv_obj_t **)&objects)[startWidgetIndex + 5], LV_STATE_CHECKED);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 5];
            if (new_val) {
                lv_obj_add_state(((lv_obj_t **)&objects)[startWidgetIndex + 5], LV_STATE_CHECKED);
            } else {
                lv_obj_clear_state(((lv_obj_t **)&objects)[startWidgetIndex + 5], LV_STATE_CHECKED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 5, 4, "Failed to evaluate Disabled state");
        bool cur_val = lv_obj_has_state(((lv_obj_t **)&objects)[startWidgetIndex + 5], LV_STATE_DISABLED);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 5];
            if (new_val) {
                lv_obj_add_state(((lv_obj_t **)&objects)[startWidgetIndex + 5], LV_STATE_DISABLED);
            } else {
                lv_obj_clear_state(((lv_obj_t **)&objects)[startWidgetIndex + 5], LV_STATE_DISABLED);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 6, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 6], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 6];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 6], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 6], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 7, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(((lv_obj_t **)&objects)[startWidgetIndex + 7]);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 7];
            lv_label_set_text(((lv_obj_t **)&objects)[startWidgetIndex + 7], new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 7, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 7], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 7];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 7], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 7], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 8, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(((lv_obj_t **)&objects)[startWidgetIndex + 8]);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 8];
            lv_label_set_text(((lv_obj_t **)&objects)[startWidgetIndex + 8], new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 8, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 8], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 8];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 8], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 8], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = evalTextProperty(flowState, 9, 4, "Failed to evaluate Text in Label widget");
        const char *cur_val = lv_label_get_text(((lv_obj_t **)&objects)[startWidgetIndex + 9]);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 9];
            lv_label_set_text(((lv_obj_t **)&objects)[startWidgetIndex + 9], new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        bool new_val = evalBooleanProperty(flowState, 9, 3, "Failed to evaluate Hidden flag");
        bool cur_val = lv_obj_has_flag(((lv_obj_t **)&objects)[startWidgetIndex + 9], LV_OBJ_FLAG_HIDDEN);
        if (new_val != cur_val) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 9];
            if (new_val) {
                lv_obj_add_flag(((lv_obj_t **)&objects)[startWidgetIndex + 9], LV_OBJ_FLAG_HIDDEN);
            } else {
                lv_obj_clear_flag(((lv_obj_t **)&objects)[startWidgetIndex + 9], LV_OBJ_FLAG_HIDDEN);
            }
            tick_value_change_obj = NULL;
        }
    }
}

typedef void (*create_screen_func_t)();
create_screen_func_t create_screen_funcs[] = {
    create_screen_standby_screen, create_screen_brew_screen,        create_screen_status_screen,  create_screen_menu_screen,
    create_screen_steam_screen,   create_screen_water_screen,       create_screen_profile_screen, create_screen_grind_screen,
    create_screen_info_screen,    create_screen_new_profile_screen, create_screen_menu_screen_1,
};
void create_screen(int screen_index) { create_screen_funcs[screen_index](); }
void create_screen_by_id(enum ScreensEnum screenId) { create_screen_funcs[screenId - 1](); }

typedef void (*delete_screen_func_t)();
delete_screen_func_t delete_screen_funcs[] = {
    delete_screen_standby_screen, delete_screen_brew_screen,        delete_screen_status_screen,  delete_screen_menu_screen,
    delete_screen_steam_screen,   delete_screen_water_screen,       delete_screen_profile_screen, delete_screen_grind_screen,
    delete_screen_info_screen,    delete_screen_new_profile_screen, delete_screen_menu_screen_1,
};
void delete_screen(int screen_index) { delete_screen_funcs[screen_index](); }
void delete_screen_by_id(enum ScreensEnum screenId) { delete_screen_funcs[screenId - 1](); }

typedef void (*tick_screen_func_t)();
tick_screen_func_t tick_screen_funcs[] = {
    tick_screen_standby_screen, tick_screen_brew_screen,        tick_screen_status_screen,  tick_screen_menu_screen,
    tick_screen_steam_screen,   tick_screen_water_screen,       tick_screen_profile_screen, tick_screen_grind_screen,
    tick_screen_info_screen,    tick_screen_new_profile_screen, tick_screen_menu_screen_1,
};
void tick_screen(int screen_index) {
    if (screen_index >= 0 && screen_index < 11) {
        tick_screen_funcs[screen_index]();
    }
}
void tick_screen_by_id(enum ScreensEnum screenId) { tick_screen(screenId - 1); }

//
// Styles
//

static const char *style_names[] = {"Text-theme-color", "images-theme-color", "screen-theme-color"};

extern void add_style(lv_obj_t *obj, int32_t styleIndex);
extern void remove_style(lv_obj_t *obj, int32_t styleIndex);

//
// Fonts
//

ext_font_desc_t fonts[] = {
#if LV_FONT_MONTSERRAT_8
    {"MONTSERRAT_8", &lv_font_montserrat_8},
#endif
#if LV_FONT_MONTSERRAT_10
    {"MONTSERRAT_10", &lv_font_montserrat_10},
#endif
#if LV_FONT_MONTSERRAT_12
    {"MONTSERRAT_12", &lv_font_montserrat_12},
#endif
#if LV_FONT_MONTSERRAT_14
    {"MONTSERRAT_14", &lv_font_montserrat_14},
#endif
#if LV_FONT_MONTSERRAT_16
    {"MONTSERRAT_16", &lv_font_montserrat_16},
#endif
#if LV_FONT_MONTSERRAT_18
    {"MONTSERRAT_18", &lv_font_montserrat_18},
#endif
#if LV_FONT_MONTSERRAT_20
    {"MONTSERRAT_20", &lv_font_montserrat_20},
#endif
#if LV_FONT_MONTSERRAT_22
    {"MONTSERRAT_22", &lv_font_montserrat_22},
#endif
#if LV_FONT_MONTSERRAT_24
    {"MONTSERRAT_24", &lv_font_montserrat_24},
#endif
#if LV_FONT_MONTSERRAT_26
    {"MONTSERRAT_26", &lv_font_montserrat_26},
#endif
#if LV_FONT_MONTSERRAT_28
    {"MONTSERRAT_28", &lv_font_montserrat_28},
#endif
#if LV_FONT_MONTSERRAT_30
    {"MONTSERRAT_30", &lv_font_montserrat_30},
#endif
#if LV_FONT_MONTSERRAT_32
    {"MONTSERRAT_32", &lv_font_montserrat_32},
#endif
#if LV_FONT_MONTSERRAT_34
    {"MONTSERRAT_34", &lv_font_montserrat_34},
#endif
#if LV_FONT_MONTSERRAT_36
    {"MONTSERRAT_36", &lv_font_montserrat_36},
#endif
#if LV_FONT_MONTSERRAT_38
    {"MONTSERRAT_38", &lv_font_montserrat_38},
#endif
#if LV_FONT_MONTSERRAT_40
    {"MONTSERRAT_40", &lv_font_montserrat_40},
#endif
#if LV_FONT_MONTSERRAT_42
    {"MONTSERRAT_42", &lv_font_montserrat_42},
#endif
#if LV_FONT_MONTSERRAT_44
    {"MONTSERRAT_44", &lv_font_montserrat_44},
#endif
#if LV_FONT_MONTSERRAT_46
    {"MONTSERRAT_46", &lv_font_montserrat_46},
#endif
#if LV_FONT_MONTSERRAT_48
    {"MONTSERRAT_48", &lv_font_montserrat_48},
#endif
};

//
// Color themes
//

void change_color_theme(uint32_t theme_index) {
    {
        if (objects.standby_screen)
            lv_obj_set_style_bg_color(objects.standby_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj7)
            lv_obj_set_style_img_recolor(objects.obj7, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.touch_icon)
            lv_obj_set_style_img_recolor(objects.touch_icon, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.time)
            lv_obj_set_style_text_color(objects.time, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.wifi_icon)
            lv_obj_set_style_border_color(objects.wifi_icon, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.wifi_icon)
            lv_obj_set_style_img_recolor(objects.wifi_icon, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.bluetooth_icon)
            lv_obj_set_style_border_color(objects.bluetooth_icon, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.bluetooth_icon)
            lv_obj_set_style_img_recolor(objects.bluetooth_icon, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.update_icon)
            lv_obj_set_style_border_color(objects.update_icon, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.update_icon)
            lv_obj_set_style_img_recolor(objects.update_icon, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.status)
            lv_obj_set_style_text_color(objects.status, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
    }
    {
        screen_brew_screen_state_t *state = &screen_brew_screen_state;
        (void)state;
        if (objects.brew_screen)
            lv_obj_set_style_bg_color(objects.brew_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj8)
            lv_obj_set_style_text_color(objects.obj8, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.start_button)
            lv_obj_set_style_img_recolor(objects.start_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.mode_switch)
            lv_obj_set_style_bg_color(objects.mode_switch, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.bluetooth_scale_icon)
            lv_obj_set_style_img_recolor(objects.bluetooth_scale_icon, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.flow_prediction_icon)
            lv_obj_set_style_img_recolor(objects.flow_prediction_icon, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.weight_label)
            lv_obj_set_style_text_color(objects.weight_label, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj9)
            lv_obj_set_style_text_color(objects.obj9, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.profile_select_button)
            lv_obj_set_style_img_recolor(objects.profile_select_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.profile_name)
            lv_obj_set_style_text_color(objects.profile_name, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.settings_button)
            lv_obj_set_style_img_recolor(objects.settings_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.target_temp)
            lv_obj_set_style_text_color(objects.target_temp, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.down_temp_button)
            lv_obj_set_style_img_recolor(objects.down_temp_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.up_temp_button)
            lv_obj_set_style_img_recolor(objects.up_temp_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj10)
            lv_obj_set_style_img_recolor(objects.obj10, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.target_duration)
            lv_obj_set_style_text_color(objects.target_duration, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj11)
            lv_obj_set_style_img_recolor(objects.obj11, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.up_duration_button)
            lv_obj_set_style_img_recolor(objects.up_duration_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.down_duration_button)
            lv_obj_set_style_img_recolor(objects.down_duration_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.target_weight_1)
            lv_obj_set_style_text_color(objects.target_weight_1, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj12)
            lv_obj_set_style_img_recolor(objects.obj12, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.up_weight_button)
            lv_obj_set_style_img_recolor(objects.up_weight_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.down_weight_button)
            lv_obj_set_style_img_recolor(objects.down_weight_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.remove_volumetric_button)
            lv_obj_set_style_img_recolor(objects.remove_volumetric_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.save_button)
            lv_obj_set_style_img_recolor(objects.save_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.accept_button)
            lv_obj_set_style_img_recolor(objects.accept_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.save_as_new_button)
            lv_obj_set_style_img_recolor(objects.save_as_new_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_brew_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 12;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        screen_status_screen_state_t *state = &screen_status_screen_state;
        (void)state;
        if (objects.pause_button)
            lv_obj_set_style_img_recolor(objects.pause_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.check_button)
            lv_obj_set_style_img_recolor(objects.check_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.step_label)
            lv_obj_set_style_text_color(objects.step_label, lv_color_hex(theme_colors[theme_index][3]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.phase_label)
            lv_obj_set_style_text_color(objects.phase_label, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.brew_bar)
            lv_obj_set_style_bg_color(objects.brew_bar, lv_color_hex(theme_colors[theme_index][3]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.brew_bar)
            lv_obj_set_style_bg_color(objects.brew_bar, lv_color_hex(theme_colors[theme_index][2]),
                                      LV_PART_INDICATOR | LV_STATE_DEFAULT);
        if (objects.phase_progress)
            lv_obj_set_style_text_color(objects.phase_progress, lv_color_hex(theme_colors[theme_index][3]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.process_volume)
            lv_obj_set_style_text_color(objects.process_volume, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_status_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 23;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        screen_menu_screen_state_t *state = &screen_menu_screen_state;
        (void)state;
        if (objects.menu_screen)
            lv_obj_set_style_bg_color(objects.menu_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_brew)
            lv_obj_set_style_bg_img_recolor(objects.btn_brew, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_steam)
            lv_obj_set_style_bg_img_recolor(objects.btn_steam, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_water)
            lv_obj_set_style_bg_img_recolor(objects.btn_water, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_grind)
            lv_obj_set_style_bg_img_recolor(objects.btn_grind, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_menu_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 34;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        screen_steam_screen_state_t *state = &screen_steam_screen_state;
        (void)state;
        if (objects.steam_screen)
            lv_obj_set_style_bg_color(objects.steam_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.steam_down_temp_button)
            lv_obj_set_style_img_recolor(objects.steam_down_temp_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.steam_up_temp_button)
            lv_obj_set_style_img_recolor(objects.steam_up_temp_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj14)
            lv_obj_set_style_img_recolor(objects.obj14, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_steam_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 45;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        screen_water_screen_state_t *state = &screen_water_screen_state;
        (void)state;
        if (objects.water_down_temp_button)
            lv_obj_set_style_img_recolor(objects.water_down_temp_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.water_up_temp_button)
            lv_obj_set_style_img_recolor(objects.water_up_temp_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.water_start_button)
            lv_obj_set_style_img_recolor(objects.water_start_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_water_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 56;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        screen_profile_screen_state_t *state = &screen_profile_screen_state;
        (void)state;
        if (objects.profile_screen)
            lv_obj_set_style_bg_color(objects.profile_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj15)
            lv_obj_set_style_text_color(objects.obj15, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.profile_name_1)
            lv_obj_set_style_text_color(objects.profile_name_1, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj16)
            lv_obj_set_style_img_recolor(objects.obj16, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj17)
            lv_obj_set_style_text_color(objects.obj17, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj18)
            lv_obj_set_style_img_recolor(objects.obj18, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj19)
            lv_obj_set_style_img_recolor(objects.obj19, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj20)
            lv_obj_set_style_text_color(objects.obj20, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj21)
            lv_obj_set_style_text_color(objects.obj21, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj22)
            lv_obj_set_style_text_color(objects.obj22, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.select_profile)
            lv_obj_set_style_img_recolor(objects.select_profile, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.previous_profile)
            lv_obj_set_style_img_recolor(objects.previous_profile, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.next_profile)
            lv_obj_set_style_img_recolor(objects.next_profile, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_profile_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 67;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        screen_grind_screen_state_t *state = &screen_grind_screen_state;
        (void)state;
        if (objects.grind_screen)
            lv_obj_set_style_bg_color(objects.grind_screen, lv_color_hex(theme_colors[theme_index][0]),
                                      LV_PART_MAIN | LV_STATE_CHECKED);
        if (objects.grind_start_button)
            lv_obj_set_style_img_recolor(objects.grind_start_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.mode_switch1)
            lv_obj_set_style_bg_color(objects.mode_switch1, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.mode_switch1)
            lv_obj_set_style_border_color(objects.mode_switch1, lv_color_hex(theme_colors[theme_index][0]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.mode_switch1)
            lv_obj_set_style_bg_color(objects.mode_switch1, lv_color_hex(theme_colors[theme_index][0]),
                                      LV_PART_MAIN | LV_STATE_CHECKED);
        if (objects.obj23)
            lv_obj_set_style_img_recolor(objects.obj23, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj23)
            lv_obj_set_style_img_recolor(objects.obj23, lv_color_hex(theme_colors[theme_index][1]),
                                         LV_PART_MAIN | LV_STATE_CHECKED);
        if (objects.obj24)
            lv_obj_set_style_text_color(objects.obj24, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj24)
            lv_obj_set_style_text_color(objects.obj24, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_CHECKED);
        if (objects.grind_down_weight_button)
            lv_obj_set_style_img_recolor(objects.grind_down_weight_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.grind_up_weight_button)
            lv_obj_set_style_img_recolor(objects.grind_up_weight_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.grind_down_duration_button)
            lv_obj_set_style_img_recolor(objects.grind_down_duration_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.grind_up_duration_button)
            lv_obj_set_style_img_recolor(objects.grind_up_duration_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        {
            screen_grind_screen_state_t *parent_state = state;
            int startWidgetIndex;
            (void)startWidgetIndex;
            {
                startWidgetIndex = 78;
                user_widget_dials_state_t *state = &parent_state->dials1_state;
                (void)state;
                if (state->scale) {
                    state->scale->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator1) {
                    state->indicator1->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator1->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale1) {
                    state->scale1->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale1->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator3) {
                    state->indicator3->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][6]);
                    state->indicator3->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][6]);
                }
                if (state->scale2) {
                    state->scale2->tick_color = lv_color_hex(theme_colors[theme_index][5]);
                    state->scale2->tick_major_color = lv_color_hex(0x000000);
                }
                if (state->indicator5) {
                    state->indicator5->type_data.scale_lines.color_start = lv_color_hex(theme_colors[theme_index][7]);
                    state->indicator5->type_data.scale_lines.color_end = lv_color_hex(theme_colors[theme_index][7]);
                }
                if (((lv_obj_t **)&objects)[startWidgetIndex + 3])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 3],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 4])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 4],
                                                 lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][6]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 5])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 5],
                                                 lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_CHECKED);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 6])
                    lv_obj_set_style_img_recolor(((lv_obj_t **)&objects)[startWidgetIndex + 6],
                                                 lv_color_hex(theme_colors[theme_index][7]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 7])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 7],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 8])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 8],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                if (((lv_obj_t **)&objects)[startWidgetIndex + 9])
                    lv_obj_set_style_text_color(((lv_obj_t **)&objects)[startWidgetIndex + 9],
                                                lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            }
        }
    }
    {
        if (objects.info_screen)
            lv_obj_set_style_bg_color(objects.info_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.wifi_icon_1)
            lv_obj_set_style_border_color(objects.wifi_icon_1, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.wifi_icon_1)
            lv_obj_set_style_img_recolor(objects.wifi_icon_1, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.bluetooth_icon_1)
            lv_obj_set_style_border_color(objects.bluetooth_icon_1, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.bluetooth_icon_1)
            lv_obj_set_style_img_recolor(objects.bluetooth_icon_1, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.update_icon_1)
            lv_obj_set_style_border_color(objects.update_icon_1, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.update_icon_1)
            lv_obj_set_style_img_recolor(objects.update_icon_1, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj25)
            lv_obj_set_style_text_color(objects.obj25, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj26)
            lv_obj_set_style_text_color(objects.obj26, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj27)
            lv_obj_set_style_text_color(objects.obj27, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj28)
            lv_obj_set_style_text_color(objects.obj28, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj29)
            lv_obj_set_style_text_color(objects.obj29, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.update_icon_2)
            lv_obj_set_style_img_recolor(objects.update_icon_2, lv_color_hex(theme_colors[theme_index][2]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.update_icon_3)
            lv_obj_set_style_img_recolor(objects.update_icon_3, lv_color_hex(theme_colors[theme_index][2]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.menu_icon_2)
            lv_obj_set_style_img_recolor(objects.menu_icon_2, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
    }
    {
        if (objects.new_profile_screen)
            lv_obj_set_style_bg_color(objects.new_profile_screen, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj30)
            lv_obj_set_style_text_color(objects.obj30, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.prev_button)
            lv_obj_set_style_bg_img_recolor(objects.prev_button, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.prev_button)
            lv_obj_set_style_img_recolor(objects.prev_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj31)
            lv_obj_set_style_text_color(objects.obj31, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj32)
            lv_obj_set_style_bg_color(objects.obj32, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj32)
            lv_obj_set_style_border_color(objects.obj32, lv_color_hex(theme_colors[theme_index][1]),
                                          LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj33)
            lv_obj_set_style_img_recolor(objects.obj33, lv_color_hex(theme_colors[theme_index][1]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj34)
            lv_obj_set_style_text_color(objects.obj34, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj35)
            lv_obj_set_style_img_recolor(objects.obj35, lv_color_hex(theme_colors[theme_index][1]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj36)
            lv_obj_set_style_text_color(objects.obj36, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj37)
            lv_obj_set_style_text_color(objects.obj37, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj38)
            lv_obj_set_style_bg_color(objects.obj38, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj38)
            lv_obj_set_style_text_color(objects.obj38, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj39)
            lv_obj_set_style_bg_color(objects.obj39, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj39)
            lv_obj_set_style_text_color(objects.obj39, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.select_button)
            lv_obj_set_style_img_recolor(objects.select_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.next_button)
            lv_obj_set_style_bg_img_recolor(objects.next_button, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.next_button)
            lv_obj_set_style_img_recolor(objects.next_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj40)
            lv_obj_set_style_bg_color(objects.obj40, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj41)
            lv_obj_set_style_text_color(objects.obj41, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj42)
            lv_obj_set_style_img_recolor(objects.obj42, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj43)
            lv_obj_set_style_img_recolor(objects.obj43, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj44)
            lv_obj_set_style_text_color(objects.obj44, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj45)
            lv_obj_set_style_text_color(objects.obj45, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj46)
            lv_obj_set_style_bg_color(objects.obj46, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj46)
            lv_obj_set_style_text_color(objects.obj46, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj47)
            lv_obj_set_style_text_color(objects.obj47, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj48)
            lv_obj_set_style_img_recolor(objects.obj48, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj49)
            lv_obj_set_style_img_recolor(objects.obj49, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj50)
            lv_obj_set_style_text_color(objects.obj50, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj51)
            lv_obj_set_style_text_color(objects.obj51, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj52)
            lv_obj_set_style_bg_color(objects.obj52, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj52)
            lv_obj_set_style_text_color(objects.obj52, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj53)
            lv_obj_set_style_text_color(objects.obj53, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj54)
            lv_obj_set_style_img_recolor(objects.obj54, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj55)
            lv_obj_set_style_img_recolor(objects.obj55, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj56)
            lv_obj_set_style_text_color(objects.obj56, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj57)
            lv_obj_set_style_text_color(objects.obj57, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj58)
            lv_obj_set_style_bg_color(objects.obj58, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj58)
            lv_obj_set_style_text_color(objects.obj58, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj59)
            lv_obj_set_style_text_color(objects.obj59, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj60)
            lv_obj_set_style_img_recolor(objects.obj60, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj61)
            lv_obj_set_style_img_recolor(objects.obj61, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj62)
            lv_obj_set_style_text_color(objects.obj62, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj63)
            lv_obj_set_style_text_color(objects.obj63, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj64)
            lv_obj_set_style_bg_color(objects.obj64, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj64)
            lv_obj_set_style_text_color(objects.obj64, lv_color_hex(theme_colors[theme_index][1]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj65)
            lv_obj_set_style_img_recolor(objects.obj65, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj66)
            lv_obj_set_style_img_recolor(objects.obj66, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
    }
    {
        if (objects.menu_screen_1)
            lv_obj_set_style_bg_color(objects.menu_screen_1, lv_color_hex(theme_colors[theme_index][1]),
                                      LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_brew_1)
            lv_obj_set_style_bg_img_recolor(objects.btn_brew_1, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_steam_1)
            lv_obj_set_style_bg_img_recolor(objects.btn_steam_1, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_water_1)
            lv_obj_set_style_bg_img_recolor(objects.btn_water_1, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_grind_1)
            lv_obj_set_style_bg_img_recolor(objects.btn_grind_1, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_settings_1)
            lv_obj_set_style_bg_img_recolor(objects.btn_settings_1, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.btn_info_1)
            lv_obj_set_style_bg_img_recolor(objects.btn_info_1, lv_color_hex(theme_colors[theme_index][0]),
                                            LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.standby_button)
            lv_obj_set_style_img_recolor(objects.standby_button, lv_color_hex(theme_colors[theme_index][0]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj67)
            lv_obj_set_style_text_color(objects.obj67, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj68)
            lv_obj_set_style_img_recolor(objects.obj68, lv_color_hex(theme_colors[theme_index][6]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj69)
            lv_obj_set_style_text_color(objects.obj69, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj70)
            lv_obj_set_style_img_recolor(objects.obj70, lv_color_hex(theme_colors[theme_index][7]),
                                         LV_PART_MAIN | LV_STATE_DEFAULT);
        if (objects.obj71)
            lv_obj_set_style_text_color(objects.obj71, lv_color_hex(theme_colors[theme_index][0]),
                                        LV_PART_MAIN | LV_STATE_DEFAULT);
    }
    lv_style_set_text_color(get_style_text_theme_color_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][0]));
    lv_style_set_img_recolor(get_style_images_theme_color_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][0]));
    lv_style_set_bg_color(get_style_screen_theme_color_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][1]));
    if (objects.standby_screen)
        lv_obj_invalidate(objects.standby_screen);
    if (objects.brew_screen)
        lv_obj_invalidate(objects.brew_screen);
    if (objects.status_screen)
        lv_obj_invalidate(objects.status_screen);
    if (objects.menu_screen)
        lv_obj_invalidate(objects.menu_screen);
    if (objects.steam_screen)
        lv_obj_invalidate(objects.steam_screen);
    if (objects.water_screen)
        lv_obj_invalidate(objects.water_screen);
    if (objects.profile_screen)
        lv_obj_invalidate(objects.profile_screen);
    if (objects.grind_screen)
        lv_obj_invalidate(objects.grind_screen);
    if (objects.info_screen)
        lv_obj_invalidate(objects.info_screen);
    if (objects.new_profile_screen)
        lv_obj_invalidate(objects.new_profile_screen);
    if (objects.menu_screen_1)
        lv_obj_invalidate(objects.menu_screen_1);
}
static const char *theme_names[] = {"Dark", "Light"};
uint32_t theme_colors[2][8] = {
    {0xfffafafa, 0xff131313, 0xff1ffba3, 0xffcccccc, 0xff0069ad, 0xffebebeb, 0xfff62c2c, 0xff2ca4f6},
    {0xff131313, 0xfffafafa, 0xff1ffba3, 0xffcccccc, 0xff0069ad, 0xffebebeb, 0xfff62c2c, 0xff2a92f6},
};

//
//
//

void create_screens() {
    // Initialize styles
    eez_flow_init_styles(add_style, remove_style);
    eez_flow_init_style_names(style_names, sizeof(style_names) / sizeof(const char *));

    eez_flow_init_fonts(fonts, sizeof(fonts) / sizeof(ext_font_desc_t));

    eez_flow_init_themes(theme_names, sizeof(theme_names) / sizeof(const char *), change_color_theme, &theme_colors[0][0],
                         sizeof(theme_colors[0]) / sizeof(uint32_t));

    // Set default LVGL theme
    lv_disp_t *dispp = lv_disp_get_default();
    lv_theme_t *theme =
        lv_theme_default_init(dispp, lv_palette_main(LV_PALETTE_BLUE), lv_palette_main(LV_PALETTE_RED), false, LV_FONT_DEFAULT);
    lv_disp_set_theme(dispp, theme);

    // Initialize screens
    eez_flow_init_screen_names(screen_names, sizeof(screen_names) / sizeof(const char *));
    eez_flow_init_object_names(object_names, sizeof(object_names) / sizeof(const char *));

    eez_flow_set_create_screen_func(create_screen);
    eez_flow_set_delete_screen_func(delete_screen);

    // Create screens
    create_screen_standby_screen();
}