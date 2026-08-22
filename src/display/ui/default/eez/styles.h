#ifndef EEZ_LVGL_UI_STYLES_H
#define EEZ_LVGL_UI_STYLES_H

#include <lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

// Style: Text-theme-color
lv_style_t *get_style_text_theme_color_MAIN_DEFAULT();
void add_style_text_theme_color(lv_obj_t *obj);
void remove_style_text_theme_color(lv_obj_t *obj);

// Style: images-theme-color
lv_style_t *get_style_images_theme_color_MAIN_DEFAULT();
void add_style_images_theme_color(lv_obj_t *obj);
void remove_style_images_theme_color(lv_obj_t *obj);

// Style: screen-theme-color
lv_style_t *get_style_screen_theme_color_MAIN_DEFAULT();
void add_style_screen_theme_color(lv_obj_t *obj);
void remove_style_screen_theme_color(lv_obj_t *obj);

#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_STYLES_H*/