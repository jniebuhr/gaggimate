#ifndef EEZ_LVGL_UI_EVENTS_H
#define EEZ_LVGL_UI_EVENTS_H

#include <lvgl/lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

extern void action_on_wakeup(lv_event_t * e);
extern void action_on_load_started(lv_event_t * e);
extern void action_on_brew_screen(lv_event_t * e);
extern void action_on_steam_screen(lv_event_t * e);
extern void action_on_water_screen(lv_event_t * e);
extern void action_on_coffee_screen(lv_event_t * e);
extern void action_on_standby(lv_event_t * e);
extern void action_brew_cancel(lv_event_t * e);
extern void action_on_brew_cancel(lv_event_t * e);
extern void action_on_menu_click(lv_event_t * e);
extern void action_on_timed_click(lv_event_t * e);
extern void action_on_volumetric_click(lv_event_t * e);
extern void action_on_profile_select(lv_event_t * e);
extern void action_on_brew_start(lv_event_t * e);
extern void action_on_brew_temp_lower(lv_event_t * e);
extern void action_on_brew_time_lower(lv_event_t * e);
extern void action_on_brew_temp_raise(lv_event_t * e);
extern void action_on_brew_time_raise(lv_event_t * e);
extern void action_on_steam_temp_lower(lv_event_t * e);
extern void action_on_steam_temp_raise(lv_event_t * e);
extern void action_on_water_temp_lower(lv_event_t * e);
extern void action_on_water_temp_raise(lv_event_t * e);
extern void action_on_profile_load(lv_event_t * e);
extern void action_on_previous_profile(lv_event_t * e);
extern void action_on_next_profile(lv_event_t * e);
extern void action_on_grind_time_lower(lv_event_t * e);
extern void action_on_grind_time_raise(lv_event_t * e);


#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_EVENTS_H*/