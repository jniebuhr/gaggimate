#include <string.h>

#include "screens.h"
#include "images.h"
#include "fonts.h"
#include "actions.h"
#include "vars.h"
#include "styles.h"
#include "ui.h"

#include <string.h>

objects_t objects;
lv_obj_t *tick_value_change_obj;
uint32_t active_theme_index = 0;

static lv_meter_scale_t * scale0;
static lv_meter_indicator_t * indicator1;
static lv_meter_scale_t * scale2;
static lv_meter_indicator_t * indicator3;

void create_screen_init_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.init_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_load_started, LV_EVENT_SCREEN_LOADED, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
    {
        lv_obj_t *parent_obj = obj;
        {
            // Logo
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.logo = obj;
            lv_obj_set_pos(obj, 0, 208);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_logo);
            lv_img_set_zoom(obj, 210);
            add_style_images_theme_color(obj);
        }
        {
            // mainLabel
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.main_label = obj;
            lv_obj_set_pos(obj, 189, 229);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            add_style_text_theme_color(obj);
            lv_obj_set_style_translate_y(obj, 150, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "Starting ...");
        }
    }
    
    tick_screen_init_screen();
}

void tick_screen_init_screen() {
}

void create_screen_standby_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.standby_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_wakeup, LV_EVENT_CLICKED, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_img_create(parent_obj);
            lv_obj_set_pos(obj, 210, 210);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_tap_60x60);
            lv_img_set_zoom(obj, 210);
            add_style_images_theme_color(obj);
            lv_obj_set_style_translate_y(obj, 150, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // time
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.time = obj;
            lv_obj_set_pos(obj, 202, 232);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_34, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_DEFAULT, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_translate_y(obj, -150, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "0:00");
        }
        {
            // Connectivity
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.connectivity = obj;
            lv_obj_set_pos(obj, 90, 231);
            lv_obj_set_size(obj, 300, 20);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            add_style_container_connectivity(obj);
            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_max_height(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_max_width(obj, 300, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_translate_y(obj, -210, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // wifiIcon
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.wifi_icon = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_wifi_20x20);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_connectivity_container_image(obj);
                }
                {
                    // bluetoothIcon
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.bluetooth_icon = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_bluetooth_alt_20x20);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_connectivity_container_image(obj);
                }
                {
                    // updateIcon
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.update_icon = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_refresh_20x20);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_connectivity_container_image(obj);
                }
            }
        }
        {
            // Logo_1
            lv_obj_t *obj = lv_img_create(parent_obj);
            objects.logo_1 = obj;
            lv_obj_set_pos(obj, 1, 209);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_img_set_src(obj, &img_logo);
            lv_img_set_zoom(obj, 210);
            add_style_images_theme_color(obj);
        }
    }
    
    tick_screen_standby_screen();
}

void tick_screen_standby_screen() {
}

void create_screen_menu_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.menu_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_load_started, LV_EVENT_SCREEN_LOADED, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 18);
        }
        {
            // contentPanel1
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel1 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW_WRAP, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_left(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 30, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // btnBrew
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.btn_brew = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, action_on_brew_screen, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_panel_imgbtn_theme(obj);
                    lv_obj_set_style_bg_img_src(obj, &img_mug_hot_alt_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // btnSteam
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.btn_steam = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, action_on_steam_screen, LV_EVENT_CLICKED, (void *)0);
                    add_style_panel_imgbtn_theme(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_wind_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // waterBtn
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.water_btn = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, action_on_water_screen, LV_EVENT_CLICKED, (void *)0);
                    add_style_panel_imgbtn_theme(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_raindrops_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // grindBtn
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.grind_btn = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 120, 120);
                    lv_obj_add_event_cb(obj, action_on_coffee_screen, LV_EVENT_CLICKED, (void *)0);
                    add_style_panel_imgbtn_theme(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_img_src(obj, &img_coffee_bean_80x80, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
        {
            // standbyButton
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.standby_button = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_power_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    }
    
    tick_screen_menu_screen();
}

void tick_screen_menu_screen() {
    tick_user_widget_dials(18);
}

void create_screen_status_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.status_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_menu_click, LV_EVENT_GESTURE, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 34);
        }
        {
            // ImgButton8
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.img_button8 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // contentPanel2
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel2 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // targetDuration
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.target_duration = obj;
                    lv_obj_set_pos(obj, 80, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "0:30");
                }
                {
                    // targetTemp
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.target_temp = obj;
                    lv_obj_set_pos(obj, -40, -120);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "93°C");
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
                    // pauseButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.pause_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_pause_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_brew_cancel, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // currentDuration
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.current_duration = obj;
                    lv_obj_set_pos(obj, 0, 70);
                    lv_obj_set_size(obj, 150, 50);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_34, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "0:15");
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
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[active_theme_index][2]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_opa(obj, 408, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "INFUSION");
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
                    lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "Blooming");
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
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
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
                            lv_bar_set_range(obj, 0, 27);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[active_theme_index][2]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 408, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_grow(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[active_theme_index][3]), LV_PART_INDICATOR | LV_STATE_DEFAULT);
                        }
                    }
                }
                {
                    // labelContainer
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.label_container = obj;
                    lv_obj_set_pos(obj, 0, 20);
                    lv_obj_set_size(obj, 320, 20);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // brewLabel
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.brew_label = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 0, 20);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[active_theme_index][2]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_opa(obj, 408, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_14, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_grow(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "27s");
                        }
                    }
                }
            }
        }
        {
            // brewVolume
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.brew_volume = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 120, 30);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            add_style_text_theme_color(obj);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "36g");
        }
    }
    
    tick_screen_status_screen();
}

void tick_screen_status_screen() {
    tick_user_widget_dials(34);
}

void create_screen_brew_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.brew_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_menu_click, LV_EVENT_GESTURE, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 59);
        }
        {
            // ImgButton5
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.img_button5 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // contentPanel4
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel4 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // mainLabel3
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.main_label3 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "Brew");
                }
                {
                    // startButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.start_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_brew_start, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // controlContainer
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.control_container = obj;
                    lv_obj_set_pos(obj, 0, -10);
                    lv_obj_set_size(obj, 300, 196);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // modeSwitch
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.mode_switch = obj;
                            lv_obj_set_pos(obj, 0, -10);
                            lv_obj_set_size(obj, 160, 50);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_grad_color(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_grad_stop(obj, 128, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_main_stop(obj, 127, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_HOR, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_side(obj, LV_BORDER_SIDE_FULL, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 2, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    // timedButton
                                    lv_obj_t *obj = lv_btn_create(parent_obj);
                                    objects.timed_button = obj;
                                    lv_obj_set_pos(obj, -40, 0);
                                    lv_obj_set_size(obj, 80, 50);
                                    lv_obj_add_event_cb(obj, action_on_timed_click, LV_EVENT_CLICKED, (void *)0);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_color(obj, lv_color_hex(0xfffafafa), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_img_src(obj, &img_clock_40x40, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_shadow_color(obj, lv_color_hex(0xff000000), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_shadow_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    // volumetricButton
                                    lv_obj_t *obj = lv_btn_create(parent_obj);
                                    objects.volumetric_button = obj;
                                    lv_obj_set_pos(obj, 40, 0);
                                    lv_obj_set_size(obj, 80, 50);
                                    lv_obj_add_event_cb(obj, action_on_volumetric_click, LV_EVENT_CLICKED, (void *)0);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_color(obj, lv_color_hex(0xfffafafa), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_img_src(obj, &img_equality_40x40, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_shadow_color(obj, lv_color_hex(0xff000000), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_shadow_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                            }
                        }
                        {
                            // profileInfo
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.profile_info = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 120);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_row(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_column(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    // Label1
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.label1 = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    add_style_text_theme_color(obj);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_label_set_text(obj, "Selected profile");
                                }
                                {
                                    // Container3
                                    lv_obj_t *obj = lv_obj_create(parent_obj);
                                    objects.container3 = obj;
                                    lv_obj_set_pos(obj, 0, 0);
                                    lv_obj_set_size(obj, 300, 40);
                                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_row(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_pad_column(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    {
                                        lv_obj_t *parent_obj = obj;
                                        {
                                            // profileName
                                            lv_obj_t *obj = lv_label_create(parent_obj);
                                            objects.profile_name = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, 0, LV_SIZE_CONTENT);
                                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_flex_grow(obj, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_label_set_text(obj, "Text");
                                        }
                                        {
                                            // profileSelectBtn
                                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                            objects.profile_select_btn = obj;
                                            lv_obj_set_pos(obj, 0, 0);
                                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 40);
                                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_refresh_40x40, NULL);
                                            lv_obj_add_event_cb(obj, action_on_profile_select, LV_EVENT_CLICKED, (void *)0);
                                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                        }
                                    }
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
                    lv_obj_set_size(obj, 300, 120);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_START, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_row(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_column(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // tempContainer
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.temp_container = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 50);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    // targetTemp1
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.target_temp1 = obj;
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
                                    lv_label_set_text(obj, "93°C");
                                }
                                {
                                    // Image5
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    objects.image5 = obj;
                                    lv_obj_set_pos(obj, -120, 0);
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
                                    // downTempButton
                                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                    objects.down_temp_button = obj;
                                    lv_obj_set_pos(obj, -60, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                                    lv_obj_add_event_cb(obj, action_on_brew_temp_lower, LV_EVENT_CLICKED, (void *)0);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    // upTempButton
                                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                    objects.up_temp_button = obj;
                                    lv_obj_set_pos(obj, 120, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                                    lv_obj_add_event_cb(obj, action_on_brew_temp_raise, LV_EVENT_CLICKED, (void *)0);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                            }
                        }
                        {
                            // targetContainer
                            lv_obj_t *obj = lv_obj_create(parent_obj);
                            objects.target_container = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 300, 50);
                            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            {
                                lv_obj_t *parent_obj = obj;
                                {
                                    // targetDuration1
                                    lv_obj_t *obj = lv_label_create(parent_obj);
                                    objects.target_duration1 = obj;
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
                                    lv_label_set_text(obj, "0:30");
                                }
                                {
                                    // Image4
                                    lv_obj_t *obj = lv_img_create(parent_obj);
                                    objects.image4 = obj;
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
                                    // downDurationButton
                                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                    objects.down_duration_button = obj;
                                    lv_obj_set_pos(obj, -60, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                                    lv_obj_add_event_cb(obj, action_on_brew_time_lower, LV_EVENT_CLICKED, (void *)0);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                                {
                                    // upDurationButton
                                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                                    objects.up_duration_button = obj;
                                    lv_obj_set_pos(obj, 120, 0);
                                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                                    lv_obj_add_event_cb(obj, action_on_brew_time_raise, LV_EVENT_CLICKED, (void *)0);
                                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    tick_screen_brew_screen();
}

void tick_screen_brew_screen() {
    tick_user_widget_dials(59);
}

void create_screen_steam_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.steam_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_menu_click, LV_EVENT_GESTURE, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 93);
        }
        {
            // ImgButton6
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.img_button6 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // contentPanel5
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel5 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
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
                    lv_label_set_text(obj, "Steam");
                }
                {
                    // goButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.go_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_brew_start, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
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
                    lv_label_set_text(obj, "145°C");
                }
                {
                    // Image5_1
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.image5_1 = obj;
                    lv_obj_set_pos(obj, 0, -60);
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
                    // downTempButton1
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.down_temp_button1 = obj;
                    lv_obj_set_pos(obj, -90, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_steam_temp_lower, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // upTempButton1
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.up_temp_button1 = obj;
                    lv_obj_set_pos(obj, 90, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_steam_temp_raise, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
    }
    
    tick_screen_steam_screen();
}

void tick_screen_steam_screen() {
    tick_user_widget_dials(93);
}

void create_screen_water_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.water_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_menu_click, LV_EVENT_GESTURE, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 111);
        }
        {
            // ImgButton7
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.img_button7 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // contentPanel6
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel6 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
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
                    lv_label_set_text(obj, "Water");
                }
                {
                    // goButton1
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.go_button1 = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_brew_start, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
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
                    lv_label_set_text(obj, "80°C");
                }
                {
                    // Image10
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    objects.image10 = obj;
                    lv_obj_set_pos(obj, 0, -60);
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
                    // downTempButton2
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.down_temp_button2 = obj;
                    lv_obj_set_pos(obj, -90, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_water_temp_lower, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // upTempButton2
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.up_temp_button2 = obj;
                    lv_obj_set_pos(obj, 90, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_water_temp_raise, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
            }
        }
    }
    
    tick_screen_water_screen();
}

void tick_screen_water_screen() {
    tick_user_widget_dials(111);
}

void create_screen_profile_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.profile_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_menu_click, LV_EVENT_GESTURE, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 129);
        }
        {
            // ImgButton1
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.img_button1 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // previousProfileBtn
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.previous_profile_btn = obj;
            lv_obj_set_pos(obj, -110, 0);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_down_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_previous_profile, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_transform_angle(obj, 900, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // nextProfileBtn
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.next_profile_btn = obj;
            lv_obj_set_pos(obj, 190, 0);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_next_profile, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_transform_angle(obj, 900, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // contentPanel
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // mainLabel7
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    objects.main_label7 = obj;
                    lv_obj_set_pos(obj, 0, -140);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "Select profile");
                }
                {
                    // chooseButton
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.choose_button = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_check_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_profile_load, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, -95);
                    lv_obj_set_size(obj, 280, 30);
                    lv_label_set_long_mode(obj, LV_LABEL_LONG_DOT);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "LM Leva 1");
                }
                {
                    // targetContainer1
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.target_container1 = obj;
                    lv_obj_set_pos(obj, 0, -62);
                    lv_obj_set_size(obj, 300, 40);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_ROW, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // tempIcon
                            lv_obj_t *obj = lv_img_create(parent_obj);
                            objects.temp_icon = obj;
                            lv_obj_set_pos(obj, -100, -50);
                            lv_obj_set_size(obj, 40, 40);
                            lv_img_set_src(obj, &img_thermometer_half_40x40);
                            lv_img_set_zoom(obj, 150);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_images_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // targetTemp4
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.target_temp4 = obj;
                            lv_obj_set_pos(obj, -50, -50);
                            lv_obj_set_size(obj, 60, 20);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "80°C");
                        }
                        {
                            // targetIcon
                            lv_obj_t *obj = lv_img_create(parent_obj);
                            objects.target_icon = obj;
                            lv_obj_set_pos(obj, 0, -50);
                            lv_obj_set_size(obj, 40, 40);
                            lv_img_set_src(obj, &img_clock_40x40);
                            lv_img_set_zoom(obj, 150);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            add_style_images_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // targetDuration2
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.target_duration2 = obj;
                            lv_obj_set_pos(obj, 50, -50);
                            lv_obj_set_size(obj, 60, 20);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "0:30");
                        }
                    }
                }
                {
                    // simpleContent
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.simple_content = obj;
                    lv_obj_set_pos(obj, 0, 30);
                    lv_obj_set_size(obj, 250, 130);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // phasesLabel
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.phases_label = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "2 Phases");
                        }
                        {
                            // stepsLabel
                            lv_obj_t *obj = lv_label_create(parent_obj);
                            objects.steps_label = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                            add_style_text_theme_color(obj);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_label_set_text(obj, "3 Steps");
                        }
                    }
                }
                {
                    // extendedContent
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.extended_content = obj;
                    lv_obj_set_pos(obj, 0, 30);
                    lv_obj_set_size(obj, 250, 130);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_layout(obj, LV_LAYOUT_FLEX, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_flow(obj, LV_FLEX_FLOW_COLUMN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_main_place(obj, LV_FLEX_ALIGN_SPACE_EVENLY, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_cross_place(obj, LV_FLEX_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_flex_track_place(obj, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // Chart1
                            lv_obj_t *obj = lv_chart_create(parent_obj);
                            objects.chart1 = obj;
                            lv_obj_set_pos(obj, 0, 0);
                            lv_obj_set_size(obj, 240, 120);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_line_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
            }
        }
    }
    
    tick_screen_profile_screen();
}

void tick_screen_profile_screen() {
    tick_user_widget_dials(129);
}

void create_screen_grind_screen() {
    lv_obj_t *obj = lv_obj_create(0);
    objects.grind_screen = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_add_event_cb(obj, action_on_menu_click, LV_EVENT_GESTURE, (void *)0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICK_FOCUSABLE|LV_OBJ_FLAG_GESTURE_BUBBLE|LV_OBJ_FLAG_SNAPPABLE|LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
    add_style_screen_theme_color(obj);
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
            create_user_widget_dials(obj, 155);
        }
        {
            // ImgButton2
            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
            objects.img_button2 = obj;
            lv_obj_set_pos(obj, 0, 210);
            lv_obj_set_size(obj, 40, 40);
            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_angle_up_40x40, NULL);
            lv_obj_add_event_cb(obj, action_on_standby, LV_EVENT_CLICKED, (void *)0);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_width(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_outline_pad(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            // contentPanel7
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.content_panel7 = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 360, 360);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_radius(obj, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
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
                    lv_label_set_text(obj, "Grind");
                }
                {
                    // startButton1
                    lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                    objects.start_button1 = obj;
                    lv_obj_set_pos(obj, 0, 130);
                    lv_obj_set_size(obj, 40, 40);
                    lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_play_40x40, NULL);
                    lv_obj_add_event_cb(obj, action_on_brew_start, LV_EVENT_CLICKED, (void *)0);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
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
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_grad_color(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_grad_stop(obj, 128, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_main_stop(obj, 127, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_HOR, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_color(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_side(obj, LV_BORDER_SIDE_FULL, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 2, LV_PART_MAIN | LV_STATE_DEFAULT);
                    {
                        lv_obj_t *parent_obj = obj;
                        {
                            // timedButton1
                            lv_obj_t *obj = lv_btn_create(parent_obj);
                            objects.timed_button1 = obj;
                            lv_obj_set_pos(obj, -40, 0);
                            lv_obj_set_size(obj, 80, 50);
                            lv_obj_add_event_cb(obj, action_on_timed_click, LV_EVENT_CLICKED, (void *)0);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(0xfffafafa), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_img_src(obj, &img_clock_40x40, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_shadow_color(obj, lv_color_hex(0xff000000), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_shadow_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // volumetricButton1
                            lv_obj_t *obj = lv_btn_create(parent_obj);
                            objects.volumetric_button1 = obj;
                            lv_obj_set_pos(obj, 40, 0);
                            lv_obj_set_size(obj, 80, 50);
                            lv_obj_add_event_cb(obj, action_on_volumetric_click, LV_EVENT_CLICKED, (void *)0);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_color(obj, lv_color_hex(0xfffafafa), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_img_src(obj, &img_equality_40x40, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_bg_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_shadow_color(obj, lv_color_hex(0xff000000), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_shadow_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
                {
                    // targetContainer2
                    lv_obj_t *obj = lv_obj_create(parent_obj);
                    objects.target_container2 = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 300, 50);
                    lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
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
                            lv_label_set_text(obj, "0:30");
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
                            // downDurationButton1
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.down_duration_button1 = obj;
                            lv_obj_set_pos(obj, -60, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_minus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, action_on_grind_time_lower, LV_EVENT_CLICKED, (void *)0);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                        {
                            // upDurationButton1
                            lv_obj_t *obj = lv_imgbtn_create(parent_obj);
                            objects.up_duration_button1 = obj;
                            lv_obj_set_pos(obj, 120, 0);
                            lv_obj_set_size(obj, LV_SIZE_CONTENT, 64);
                            lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_plus_small_40x40, NULL);
                            lv_obj_add_event_cb(obj, action_on_grind_time_raise, LV_EVENT_CLICKED, (void *)0);
                            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor(obj, lv_color_hex(theme_colors[active_theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
                            lv_obj_set_style_img_recolor_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
                        }
                    }
                }
            }
        }
    }
    
    tick_screen_grind_screen();
}

void tick_screen_grind_screen() {
    tick_user_widget_dials(155);
}

void create_user_widget_dials(lv_obj_t *parent_obj, int startWidgetIndex) {
    (void)startWidgetIndex;
    lv_obj_t *obj = parent_obj;
    {
        lv_obj_t *parent_obj = obj;
        {
            // dials
            lv_obj_t *obj = lv_obj_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 0] = obj;
            lv_obj_set_pos(obj, 0, 0);
            lv_obj_set_size(obj, 480, 480);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
            lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
            lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
            lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
            lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    // tempTarget
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 1] = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_indicator);
                    lv_img_set_angle(obj, -900);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_images_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // tempGauge
                    lv_obj_t *obj = lv_arc_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 2] = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 480, 480);
                    lv_arc_set_range(obj, 0, 160);
                    lv_arc_set_value(obj, 80);
                    lv_arc_set_bg_start_angle(obj, 118);
                    lv_arc_set_bg_end_angle(obj, 242);
                    lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_CHAIN_HOR|LV_OBJ_FLAG_SCROLL_CHAIN_VER);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_add_state(obj, LV_STATE_DISABLED);
                    lv_obj_set_style_arc_width(obj, 35, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_rounded(obj, false, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_img_src(obj, &img_main_gauge, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_width(obj, 35, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_rounded(obj, false, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_img_src(obj, &img_gauge_fill, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_KNOB | LV_STATE_DEFAULT);
                }
                {
                    // pressureTarget
                    lv_obj_t *obj = lv_img_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 3] = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_img_set_src(obj, &img_indicator);
                    lv_img_set_angle(obj, 900);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_images_theme_color(obj);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                }
                {
                    // pressureGauge
                    lv_obj_t *obj = lv_arc_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 4] = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 480, 480);
                    lv_arc_set_range(obj, 0, 16);
                    lv_arc_set_value(obj, 8);
                    lv_arc_set_bg_start_angle(obj, 298);
                    lv_arc_set_bg_end_angle(obj, 62);
                    lv_arc_set_mode(obj, LV_ARC_MODE_REVERSE);
                    lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_SCROLL_CHAIN_HOR|LV_OBJ_FLAG_SCROLL_CHAIN_VER);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_add_state(obj, LV_STATE_DISABLED);
                    lv_obj_set_style_arc_width(obj, 35, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_rounded(obj, false, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_img_src(obj, &img_main_gauge, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_width(obj, 35, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_rounded(obj, false, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_arc_img_src(obj, &img_pressure_filled, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_KNOB | LV_STATE_DEFAULT);
                }
                {
                    // tempMeter
                    lv_obj_t *obj = lv_meter_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 5] = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 480, 480);
                    {
                        lv_meter_scale_t *scale = lv_meter_add_scale(obj);
                        scale0 = scale;
                        lv_meter_set_scale_ticks(obj, scale, 25, 10, 25, lv_color_hex(0xffebebeb));
                        lv_meter_set_scale_major_ticks(obj, scale, 0, 0, 10, lv_color_hex(0xff000000), 0);
                        lv_meter_set_scale_range(obj, scale, 0, 160, 124, 120);
                        {
                            lv_meter_indicator_t *indicator = lv_meter_add_scale_lines(obj, scale, lv_color_hex(0xfff62c2c), lv_color_hex(0xfff62c2c), false, 0);
                            indicator1 = indicator;
                            lv_meter_set_indicator_start_value(obj, indicator, 0);
                            lv_meter_set_indicator_end_value(obj, indicator, 93);
                        }
                        {
                            lv_meter_indicator_t *indicator = lv_meter_add_needle_img(obj, scale, &img_indicator_small, -230, 4);
                            lv_meter_set_indicator_value(obj, indicator, 93);
                        }
                    }
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_opa(obj, 0, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                }
                {
                    // pressureMeter
                    lv_obj_t *obj = lv_meter_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 6] = obj;
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, 480, 480);
                    {
                        lv_meter_scale_t *scale = lv_meter_add_scale(obj);
                        scale2 = scale;
                        lv_meter_set_scale_ticks(obj, scale, 25, 10, 25, lv_color_hex(0xffebebeb));
                        lv_meter_set_scale_major_ticks(obj, scale, 0, 0, 10, lv_color_hex(0xff000000), 0);
                        lv_meter_set_scale_range(obj, scale, 9, 0, 124, -60);
                        {
                            lv_meter_indicator_t *indicator = lv_meter_add_needle_img(obj, scale, &img_indicator_small, -230, 4);
                            lv_meter_set_indicator_value(obj, indicator, 5);
                        }
                        {
                            lv_meter_indicator_t *indicator = lv_meter_add_scale_lines(obj, scale, lv_color_hex(0xff2ca4f6), lv_color_hex(0xff2ca4f6), false, 0);
                            indicator3 = indicator;
                            lv_meter_set_indicator_start_value(obj, indicator, 0);
                            lv_meter_set_indicator_end_value(obj, indicator, 5);
                        }
                    }
                    lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_border_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_opa(obj, 0, LV_PART_INDICATOR | LV_STATE_DEFAULT);
                }
                {
                    // pressureText
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 7] = obj;
                    lv_obj_set_pos(obj, 50, -205);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "9 bar");
                }
                {
                    // tempText
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    ((lv_obj_t **)&objects)[startWidgetIndex + 8] = obj;
                    lv_obj_set_pos(obj, -50, -205);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_WITH_ARROW);
                    lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
                    lv_obj_set_scroll_dir(obj, LV_DIR_ALL);
                    lv_obj_set_scroll_snap_x(obj, LV_SCROLL_SNAP_NONE);
                    lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_NONE);
                    add_style_text_theme_color(obj);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "92°C");
                }
            }
        }
    }
}

void tick_user_widget_dials(int startWidgetIndex) {
    (void)startWidgetIndex;
}

void change_color_theme(uint32_t theme_index) {
    active_theme_index = theme_index;
    
    lv_style_set_img_recolor(get_style_images_theme_color_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][0]));
    
    lv_style_set_border_color(get_style_connectivity_container_image_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][1]));
    
    lv_style_set_text_color(get_style_text_theme_color_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][0]));
    
    lv_style_set_bg_color(get_style_screen_theme_color_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][1]));
    
    lv_style_set_bg_img_recolor(get_style_panel_imgbtn_theme_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][0]));
    
    lv_style_set_shadow_color(get_style_panel_imgbtn_theme_MAIN_DEFAULT(), lv_color_hex(theme_colors[theme_index][1]));
    
    lv_obj_set_style_bg_color(objects.standby_screen, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_text_color(objects.time, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.standby_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.img_button8, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel2, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.pause_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_text_color(objects.step_label, lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_text_color(objects.phase_label, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_color(objects.brew_bar, lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_color(objects.brew_bar, lv_color_hex(theme_colors[theme_index][3]), LV_PART_INDICATOR | LV_STATE_DEFAULT);
    
    lv_obj_set_style_text_color(objects.brew_label, lv_color_hex(theme_colors[theme_index][2]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.img_button5, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel4, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.start_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_color(objects.mode_switch, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_grad_color(objects.mode_switch, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.mode_switch, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_img_recolor(objects.timed_button, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_img_recolor(objects.volumetric_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_text_color(objects.profile_name, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.profile_select_btn, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.down_temp_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.up_temp_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.down_duration_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.up_duration_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.img_button6, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel5, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.go_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.down_temp_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.up_temp_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.img_button7, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel6, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.go_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.down_temp_button2, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.up_temp_button2, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.img_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.previous_profile_btn, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.next_profile_btn, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.choose_button, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_color(objects.chart1, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.chart1, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.img_button2, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.content_panel7, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.start_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_color(objects.mode_switch1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_grad_color(objects.mode_switch1, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_border_color(objects.mode_switch1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_img_recolor(objects.timed_button1, lv_color_hex(theme_colors[theme_index][1]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_bg_img_recolor(objects.volumetric_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.down_duration_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_set_style_img_recolor(objects.up_duration_button1, lv_color_hex(theme_colors[theme_index][0]), LV_PART_MAIN | LV_STATE_DEFAULT);
    
    lv_obj_invalidate(objects.init_screen);
    lv_obj_invalidate(objects.standby_screen);
    lv_obj_invalidate(objects.menu_screen);
    lv_obj_invalidate(objects.status_screen);
    lv_obj_invalidate(objects.brew_screen);
    lv_obj_invalidate(objects.steam_screen);
    lv_obj_invalidate(objects.water_screen);
    lv_obj_invalidate(objects.profile_screen);
    lv_obj_invalidate(objects.grind_screen);
}

uint32_t theme_colors[2][4] = {
    { 0xfffafafa, 0xff131313, 0xffffffff, 0xff1ffba3 },
    { 0xff131313, 0xfffafafa, 0xffcccccc, 0xff1ffba3 },
};


typedef void (*tick_screen_func_t)();
tick_screen_func_t tick_screen_funcs[] = {
    tick_screen_init_screen,
    tick_screen_standby_screen,
    tick_screen_menu_screen,
    tick_screen_status_screen,
    tick_screen_brew_screen,
    tick_screen_steam_screen,
    tick_screen_water_screen,
    tick_screen_profile_screen,
    tick_screen_grind_screen,
};
void tick_screen(int screen_index) {
    tick_screen_funcs[screen_index]();
}
void tick_screen_by_id(enum ScreensEnum screenId) {
    tick_screen_funcs[screenId - 1]();
}

void create_screens() {
    lv_disp_t *dispp = lv_disp_get_default();
    lv_theme_t *theme = lv_theme_default_init(dispp, lv_palette_main(LV_PALETTE_BLUE), lv_palette_main(LV_PALETTE_RED), false, LV_FONT_DEFAULT);
    lv_disp_set_theme(dispp, theme);
    
    create_screen_init_screen();
    create_screen_standby_screen();
    create_screen_menu_screen();
    create_screen_status_screen();
    create_screen_brew_screen();
    create_screen_steam_screen();
    create_screen_water_screen();
    create_screen_profile_screen();
    create_screen_grind_screen();
}
