#ifndef EEZ_LVGL_UI_SCREENS_H
#define EEZ_LVGL_UI_SCREENS_H

#include <lvgl/lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct _objects_t {
    lv_obj_t *init_screen;
    lv_obj_t *standby_screen;
    lv_obj_t *menu_screen;
    lv_obj_t *status_screen;
    lv_obj_t *brew_screen;
    lv_obj_t *steam_screen;
    lv_obj_t *water_screen;
    lv_obj_t *profile_screen;
    lv_obj_t *grind_screen;
    lv_obj_t *logo;
    lv_obj_t *main_label;
    lv_obj_t *time;
    lv_obj_t *connectivity;
    lv_obj_t *wifi_icon;
    lv_obj_t *bluetooth_icon;
    lv_obj_t *update_icon;
    lv_obj_t *logo_1;
    lv_obj_t *obj0;
    lv_obj_t *obj0__dials;
    lv_obj_t *obj0__temp_target;
    lv_obj_t *obj0__temp_gauge;
    lv_obj_t *obj0__pressure_target;
    lv_obj_t *obj0__pressure_gauge;
    lv_obj_t *obj0__temp_meter;
    lv_obj_t *obj0__pressure_meter;
    lv_obj_t *obj0__pressure_text;
    lv_obj_t *obj0__temp_text;
    lv_obj_t *content_panel1;
    lv_obj_t *btn_brew;
    lv_obj_t *btn_steam;
    lv_obj_t *water_btn;
    lv_obj_t *grind_btn;
    lv_obj_t *standby_button;
    lv_obj_t *obj1;
    lv_obj_t *obj1__dials;
    lv_obj_t *obj1__temp_target;
    lv_obj_t *obj1__temp_gauge;
    lv_obj_t *obj1__pressure_target;
    lv_obj_t *obj1__pressure_gauge;
    lv_obj_t *obj1__temp_meter;
    lv_obj_t *obj1__pressure_meter;
    lv_obj_t *obj1__pressure_text;
    lv_obj_t *obj1__temp_text;
    lv_obj_t *img_button8;
    lv_obj_t *content_panel2;
    lv_obj_t *target_duration;
    lv_obj_t *target_temp;
    lv_obj_t *image7;
    lv_obj_t *image8;
    lv_obj_t *pause_button;
    lv_obj_t *current_duration;
    lv_obj_t *step_label;
    lv_obj_t *phase_label;
    lv_obj_t *bar_container;
    lv_obj_t *brew_bar;
    lv_obj_t *label_container;
    lv_obj_t *brew_label;
    lv_obj_t *brew_volume;
    lv_obj_t *obj2;
    lv_obj_t *obj2__dials;
    lv_obj_t *obj2__temp_target;
    lv_obj_t *obj2__temp_gauge;
    lv_obj_t *obj2__pressure_target;
    lv_obj_t *obj2__pressure_gauge;
    lv_obj_t *obj2__temp_meter;
    lv_obj_t *obj2__pressure_meter;
    lv_obj_t *obj2__pressure_text;
    lv_obj_t *obj2__temp_text;
    lv_obj_t *img_button5;
    lv_obj_t *content_panel4;
    lv_obj_t *main_label3;
    lv_obj_t *start_button;
    lv_obj_t *control_container;
    lv_obj_t *mode_switch;
    lv_obj_t *timed_button;
    lv_obj_t *volumetric_button;
    lv_obj_t *profile_info;
    lv_obj_t *label1;
    lv_obj_t *container3;
    lv_obj_t *profile_name;
    lv_obj_t *profile_select_btn;
    lv_obj_t *adjustments;
    lv_obj_t *temp_container;
    lv_obj_t *target_temp1;
    lv_obj_t *image5;
    lv_obj_t *down_temp_button;
    lv_obj_t *up_temp_button;
    lv_obj_t *target_container;
    lv_obj_t *target_duration1;
    lv_obj_t *image4;
    lv_obj_t *down_duration_button;
    lv_obj_t *up_duration_button;
    lv_obj_t *obj3;
    lv_obj_t *obj3__dials;
    lv_obj_t *obj3__temp_target;
    lv_obj_t *obj3__temp_gauge;
    lv_obj_t *obj3__pressure_target;
    lv_obj_t *obj3__pressure_gauge;
    lv_obj_t *obj3__temp_meter;
    lv_obj_t *obj3__pressure_meter;
    lv_obj_t *obj3__pressure_text;
    lv_obj_t *obj3__temp_text;
    lv_obj_t *img_button6;
    lv_obj_t *content_panel5;
    lv_obj_t *main_label5;
    lv_obj_t *go_button;
    lv_obj_t *target_temp2;
    lv_obj_t *image5_1;
    lv_obj_t *down_temp_button1;
    lv_obj_t *up_temp_button1;
    lv_obj_t *obj4;
    lv_obj_t *obj4__dials;
    lv_obj_t *obj4__temp_target;
    lv_obj_t *obj4__temp_gauge;
    lv_obj_t *obj4__pressure_target;
    lv_obj_t *obj4__pressure_gauge;
    lv_obj_t *obj4__temp_meter;
    lv_obj_t *obj4__pressure_meter;
    lv_obj_t *obj4__pressure_text;
    lv_obj_t *obj4__temp_text;
    lv_obj_t *img_button7;
    lv_obj_t *content_panel6;
    lv_obj_t *main_label6;
    lv_obj_t *go_button1;
    lv_obj_t *target_temp3;
    lv_obj_t *image10;
    lv_obj_t *down_temp_button2;
    lv_obj_t *up_temp_button2;
    lv_obj_t *obj5;
    lv_obj_t *obj5__dials;
    lv_obj_t *obj5__temp_target;
    lv_obj_t *obj5__temp_gauge;
    lv_obj_t *obj5__pressure_target;
    lv_obj_t *obj5__pressure_gauge;
    lv_obj_t *obj5__temp_meter;
    lv_obj_t *obj5__pressure_meter;
    lv_obj_t *obj5__pressure_text;
    lv_obj_t *obj5__temp_text;
    lv_obj_t *img_button1;
    lv_obj_t *previous_profile_btn;
    lv_obj_t *next_profile_btn;
    lv_obj_t *content_panel;
    lv_obj_t *main_label7;
    lv_obj_t *choose_button;
    lv_obj_t *target_container1;
    lv_obj_t *temp_icon;
    lv_obj_t *target_temp4;
    lv_obj_t *target_icon;
    lv_obj_t *target_duration2;
    lv_obj_t *simple_content;
    lv_obj_t *phases_label;
    lv_obj_t *steps_label;
    lv_obj_t *extended_content;
    lv_obj_t *chart1;
    lv_obj_t *obj6;
    lv_obj_t *obj6__dials;
    lv_obj_t *obj6__temp_target;
    lv_obj_t *obj6__temp_gauge;
    lv_obj_t *obj6__pressure_target;
    lv_obj_t *obj6__pressure_gauge;
    lv_obj_t *obj6__temp_meter;
    lv_obj_t *obj6__pressure_meter;
    lv_obj_t *obj6__pressure_text;
    lv_obj_t *obj6__temp_text;
    lv_obj_t *img_button2;
    lv_obj_t *content_panel7;
    lv_obj_t *main_label4;
    lv_obj_t *start_button1;
    lv_obj_t *mode_switch1;
    lv_obj_t *timed_button1;
    lv_obj_t *volumetric_button1;
    lv_obj_t *target_container2;
    lv_obj_t *target_duration3;
    lv_obj_t *target_symbol;
    lv_obj_t *down_duration_button1;
    lv_obj_t *up_duration_button1;
} objects_t;

extern objects_t objects;

enum ScreensEnum {
    SCREEN_ID_INIT_SCREEN = 1,
    SCREEN_ID_STANDBY_SCREEN = 2,
    SCREEN_ID_MENU_SCREEN = 3,
    SCREEN_ID_STATUS_SCREEN = 4,
    SCREEN_ID_BREW_SCREEN = 5,
    SCREEN_ID_STEAM_SCREEN = 6,
    SCREEN_ID_WATER_SCREEN = 7,
    SCREEN_ID_PROFILE_SCREEN = 8,
    SCREEN_ID_GRIND_SCREEN = 9,
};

void create_screen_init_screen();
void tick_screen_init_screen();

void create_screen_standby_screen();
void tick_screen_standby_screen();

void create_screen_menu_screen();
void tick_screen_menu_screen();

void create_screen_status_screen();
void tick_screen_status_screen();

void create_screen_brew_screen();
void tick_screen_brew_screen();

void create_screen_steam_screen();
void tick_screen_steam_screen();

void create_screen_water_screen();
void tick_screen_water_screen();

void create_screen_profile_screen();
void tick_screen_profile_screen();

void create_screen_grind_screen();
void tick_screen_grind_screen();

void create_user_widget_dials(lv_obj_t *parent_obj, int startWidgetIndex);
void tick_user_widget_dials(int startWidgetIndex);

enum Themes {
    THEME_ID_DEFAULT_THEME,
    THEME_ID_LIGHT,
};
enum Colors {
    COLOR_ID_NICE_WHITE,
    COLOR_ID_DARK,
    COLOR_ID_SEMI_DARK,
    COLOR_ID_PROGRESS,
};
void change_color_theme(uint32_t themeIndex);
extern uint32_t theme_colors[2][4];
extern uint32_t active_theme_index;

void tick_screen_by_id(enum ScreensEnum screenId);
void tick_screen(int screen_index);

void create_screens();


#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_SCREENS_H*/