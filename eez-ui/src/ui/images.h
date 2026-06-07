#ifndef EEZ_LVGL_UI_IMAGES_H
#define EEZ_LVGL_UI_IMAGES_H

#include <lvgl/lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

extern const lv_img_dsc_t img_settings_40x40;
extern const lv_img_dsc_t img_refresh_40x40;
extern const lv_img_dsc_t img_wind_80x80;
extern const lv_img_dsc_t img_wifi_20x20;
extern const lv_img_dsc_t img_thermometer_half_40x40;
extern const lv_img_dsc_t img_tap_60x60;
extern const lv_img_dsc_t img_refresh_20x20;
extern const lv_img_dsc_t img_raindrops_80x80;
extern const lv_img_dsc_t img_pressure_filled;
extern const lv_img_dsc_t img_power_40x40;
extern const lv_img_dsc_t img_plus_small_40x40;
extern const lv_img_dsc_t img_play_40x40;
extern const lv_img_dsc_t img_pause_40x40;
extern const lv_img_dsc_t img_mug_hot_alt_80x80;
extern const lv_img_dsc_t img_minus_small_40x40;
extern const lv_img_dsc_t img_logo;
extern const lv_img_dsc_t img_indicator;
extern const lv_img_dsc_t img_gauge_fill;
extern const lv_img_dsc_t img_equality_40x40;
extern const lv_img_dsc_t img_coffee_bean_80x80;
extern const lv_img_dsc_t img_clock_40x40;
extern const lv_img_dsc_t img_check_40x40;
extern const lv_img_dsc_t img_bluetooth_alt_20x20;
extern const lv_img_dsc_t img_angle_up_40x40;
extern const lv_img_dsc_t img_angle_down_40x40;
extern const lv_img_dsc_t img_main_gauge;
extern const lv_img_dsc_t img_indicator_small;

#ifndef EXT_IMG_DESC_T
#define EXT_IMG_DESC_T
typedef struct _ext_img_desc_t {
    const char *name;
    const lv_img_dsc_t *img_dsc;
} ext_img_desc_t;
#endif

extern const ext_img_desc_t images[27];


#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_IMAGES_H*/