#ifndef EEZ_LVGL_UI_EVENTS_H
#define EEZ_LVGL_UI_EVENTS_H

#include <lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

extern void action_on_wakeup(lv_event_t *e);
extern void action_on_load_started(lv_event_t *e);
extern void action_on_menu_click(lv_event_t *e);
extern void action_on_brew_screen(lv_event_t *e);
extern void action_on_steam_screen(lv_event_t *e);
extern void action_on_water_screen(lv_event_t *e);
extern void action_on_grind_screen(lv_event_t *e);
extern void action_on_brew_start(lv_event_t *e);
extern void action_on_flush(lv_event_t *e);
extern void action_on_volumetric_hold(lv_event_t *e);
extern void action_on_profile_select(lv_event_t *e);
extern void action_on_profile_settings(lv_event_t *e);
extern void action_on_brew_temp_lower(lv_event_t *e);
extern void action_on_brew_temp_raise(lv_event_t *e);
extern void action_on_brew_time_raise(lv_event_t *e);
extern void action_on_brew_time_lower(lv_event_t *e);
extern void action_on_volumetric_delete(lv_event_t *e);
extern void action_on_profile_accept(lv_event_t *e);
extern void action_on_profile_save(lv_event_t *e);
extern void action_on_profile_save_as_new(lv_event_t *e);
extern void action_on_meter_draw(lv_event_t *e);
extern void action_on_steam_temp_lower(lv_event_t *e);
extern void action_on_steam_temp_raise(lv_event_t *e);
extern void action_on_grind_time_lower(lv_event_t *e);
extern void action_on_grind_time_raise(lv_event_t *e);
extern void action_on_timed_click(lv_event_t *e);
extern void action_on_volumetric_click(lv_event_t *e);
extern void action_on_grind_toggle(lv_event_t *e);
extern void action_on_simple_process_toggle(lv_event_t *e);
extern void action_on_profile_load(lv_event_t *e);
extern void action_on_previous_profile(lv_event_t *e);
extern void action_on_next_profile(lv_event_t *e);
extern void action_on_brew_cancel(lv_event_t *e);
extern void action_on_standby(lv_event_t *e);
extern void action_on_screen_load(lv_event_t *e);
extern void action_on_screen_swipe(lv_event_t *e);

#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_EVENTS_H*/