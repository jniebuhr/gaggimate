#include "styles.h"
#include "fonts.h"
#include "images.h"

#include "screens.h"
#include "ui.h"

//
// Style: Text-theme-color
//

void init_style_text_theme_color_MAIN_DEFAULT(lv_style_t *style) {
    lv_style_set_text_color(style, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]));
    lv_style_set_text_opa(style, 255);
};

lv_style_t *get_style_text_theme_color_MAIN_DEFAULT() {
    static lv_style_t *style;
    if (!style) {
        style = (lv_style_t *)lv_mem_alloc(sizeof(lv_style_t));
        lv_style_init(style);
        init_style_text_theme_color_MAIN_DEFAULT(style);
    }
    return style;
};

void add_style_text_theme_color(lv_obj_t *obj) {
    (void)obj;
    lv_obj_add_style(obj, get_style_text_theme_color_MAIN_DEFAULT(), LV_PART_MAIN | LV_STATE_DEFAULT);
};

void remove_style_text_theme_color(lv_obj_t *obj) {
    (void)obj;
    lv_obj_remove_style(obj, get_style_text_theme_color_MAIN_DEFAULT(), LV_PART_MAIN | LV_STATE_DEFAULT);
};

//
// Style: images-theme-color
//

void init_style_images_theme_color_MAIN_DEFAULT(lv_style_t *style) {
    lv_style_set_img_recolor(style, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][0]));
    lv_style_set_img_recolor_opa(style, 255);
};

lv_style_t *get_style_images_theme_color_MAIN_DEFAULT() {
    static lv_style_t *style;
    if (!style) {
        style = (lv_style_t *)lv_mem_alloc(sizeof(lv_style_t));
        lv_style_init(style);
        init_style_images_theme_color_MAIN_DEFAULT(style);
    }
    return style;
};

void add_style_images_theme_color(lv_obj_t *obj) {
    (void)obj;
    lv_obj_add_style(obj, get_style_images_theme_color_MAIN_DEFAULT(), LV_PART_MAIN | LV_STATE_DEFAULT);
};

void remove_style_images_theme_color(lv_obj_t *obj) {
    (void)obj;
    lv_obj_remove_style(obj, get_style_images_theme_color_MAIN_DEFAULT(), LV_PART_MAIN | LV_STATE_DEFAULT);
};

//
// Style: screen-theme-color
//

void init_style_screen_theme_color_MAIN_DEFAULT(lv_style_t *style) {
    lv_style_set_bg_color(style, lv_color_hex(theme_colors[eez_flow_get_selected_theme_index()][1]));
    lv_style_set_bg_opa(style, 255);
};

lv_style_t *get_style_screen_theme_color_MAIN_DEFAULT() {
    static lv_style_t *style;
    if (!style) {
        style = (lv_style_t *)lv_mem_alloc(sizeof(lv_style_t));
        lv_style_init(style);
        init_style_screen_theme_color_MAIN_DEFAULT(style);
    }
    return style;
};

void add_style_screen_theme_color(lv_obj_t *obj) {
    (void)obj;
    lv_obj_add_style(obj, get_style_screen_theme_color_MAIN_DEFAULT(), LV_PART_MAIN | LV_STATE_DEFAULT);
};

void remove_style_screen_theme_color(lv_obj_t *obj) {
    (void)obj;
    lv_obj_remove_style(obj, get_style_screen_theme_color_MAIN_DEFAULT(), LV_PART_MAIN | LV_STATE_DEFAULT);
};

//
//
//

void add_style(lv_obj_t *obj, int32_t styleIndex) {
    typedef void (*AddStyleFunc)(lv_obj_t *obj);
    static const AddStyleFunc add_style_funcs[] = {
        add_style_text_theme_color,
        add_style_images_theme_color,
        add_style_screen_theme_color,
    };
    add_style_funcs[styleIndex](obj);
}

void remove_style(lv_obj_t *obj, int32_t styleIndex) {
    typedef void (*RemoveStyleFunc)(lv_obj_t *obj);
    static const RemoveStyleFunc remove_style_funcs[] = {
        remove_style_text_theme_color,
        remove_style_images_theme_color,
        remove_style_screen_theme_color,
    };
    remove_style_funcs[styleIndex](obj);
}