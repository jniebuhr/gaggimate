// This file was generated by SquareLine Studio
// SquareLine Studio version: SquareLine Studio 1.5.0
// LVGL version: 8.3.11
// Project name: GaggiMate

#include "../ui.h"

void ui_MenuScreen_screen_init(void)
{
    ui_MenuScreen = lv_obj_create(NULL);
    lv_obj_clear_flag(ui_MenuScreen, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    ui_object_set_themeable_style_property(ui_MenuScreen, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(ui_MenuScreen, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Dark);

    ui_MenuScreen_tempTarget = lv_img_create(ui_MenuScreen);
    lv_img_set_src(ui_MenuScreen_tempTarget, &ui_img_indicator_png);
    lv_obj_set_width(ui_MenuScreen_tempTarget, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_MenuScreen_tempTarget, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_align(ui_MenuScreen_tempTarget, LV_ALIGN_CENTER);
    lv_obj_add_flag(ui_MenuScreen_tempTarget, LV_OBJ_FLAG_ADV_HITTEST);     /// Flags
    lv_obj_clear_flag(ui_MenuScreen_tempTarget, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    lv_img_set_angle(ui_MenuScreen_tempTarget, 250);
    ui_object_set_themeable_style_property(ui_MenuScreen_tempTarget, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_tempTarget, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_tempGauge = lv_arc_create(ui_MenuScreen);
    lv_obj_set_width(ui_MenuScreen_tempGauge, 480);
    lv_obj_set_height(ui_MenuScreen_tempGauge, 480);
    lv_obj_set_align(ui_MenuScreen_tempGauge, LV_ALIGN_CENTER);
    lv_obj_add_state(ui_MenuScreen_tempGauge, LV_STATE_DISABLED);       /// States
    lv_arc_set_range(ui_MenuScreen_tempGauge, 0, 160);
    lv_arc_set_value(ui_MenuScreen_tempGauge, 80);
    lv_arc_set_bg_angles(ui_MenuScreen_tempGauge, 112, 68);
    lv_obj_set_style_arc_width(ui_MenuScreen_tempGauge, 35, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(ui_MenuScreen_tempGauge, false, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_img_src(ui_MenuScreen_tempGauge, &ui_img_untitled_png, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_set_style_arc_width(ui_MenuScreen_tempGauge, 35, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(ui_MenuScreen_tempGauge, false, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_img_src(ui_MenuScreen_tempGauge, &ui_img_489054950, LV_PART_INDICATOR | LV_STATE_DEFAULT);

    lv_obj_set_style_bg_color(ui_MenuScreen_tempGauge, lv_color_hex(0xD10000), LV_PART_KNOB | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(ui_MenuScreen_tempGauge, 0, LV_PART_KNOB | LV_STATE_DEFAULT);

    ui_MenuScreen_pressureTarget = lv_img_create(ui_MenuScreen);
    lv_img_set_src(ui_MenuScreen_pressureTarget, &ui_img_indicator_png);
    lv_obj_set_width(ui_MenuScreen_pressureTarget, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_MenuScreen_pressureTarget, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_align(ui_MenuScreen_pressureTarget, LV_ALIGN_CENTER);
    lv_obj_add_flag(ui_MenuScreen_pressureTarget, LV_OBJ_FLAG_HIDDEN | LV_OBJ_FLAG_ADV_HITTEST);     /// Flags
    lv_obj_clear_flag(ui_MenuScreen_pressureTarget, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    lv_img_set_angle(ui_MenuScreen_pressureTarget, 36);
    ui_object_set_themeable_style_property(ui_MenuScreen_pressureTarget, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_pressureTarget, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_pressureGauge = lv_arc_create(ui_MenuScreen);
    lv_obj_set_width(ui_MenuScreen_pressureGauge, 480);
    lv_obj_set_height(ui_MenuScreen_pressureGauge, 480);
    lv_obj_set_align(ui_MenuScreen_pressureGauge, LV_ALIGN_CENTER);
    lv_obj_add_state(ui_MenuScreen_pressureGauge, LV_STATE_DISABLED);       /// States
    lv_obj_add_flag(ui_MenuScreen_pressureGauge, LV_OBJ_FLAG_HIDDEN);     /// Flags
    lv_arc_set_range(ui_MenuScreen_pressureGauge, 0, 160);
    lv_arc_set_value(ui_MenuScreen_pressureGauge, 90);
    lv_arc_set_bg_angles(ui_MenuScreen_pressureGauge, 48, 132);
    lv_arc_set_mode(ui_MenuScreen_pressureGauge, LV_ARC_MODE_REVERSE);
    lv_obj_set_style_arc_width(ui_MenuScreen_pressureGauge, 35, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(ui_MenuScreen_pressureGauge, false, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_img_src(ui_MenuScreen_pressureGauge, &ui_img_untitled_png, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_set_style_arc_width(ui_MenuScreen_pressureGauge, 35, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(ui_MenuScreen_pressureGauge, false, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_img_src(ui_MenuScreen_pressureGauge, &ui_img_1455708189, LV_PART_INDICATOR | LV_STATE_DEFAULT);

    lv_obj_set_style_bg_color(ui_MenuScreen_pressureGauge, lv_color_hex(0xD10000), LV_PART_KNOB | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(ui_MenuScreen_pressureGauge, 0, LV_PART_KNOB | LV_STATE_DEFAULT);

    ui_MenuScreen_contentPanel1 = lv_obj_create(ui_MenuScreen);
    lv_obj_set_width(ui_MenuScreen_contentPanel1, 360);
    lv_obj_set_height(ui_MenuScreen_contentPanel1, 360);
    lv_obj_set_align(ui_MenuScreen_contentPanel1, LV_ALIGN_CENTER);
    lv_obj_clear_flag(ui_MenuScreen_contentPanel1, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    lv_obj_set_style_radius(ui_MenuScreen_contentPanel1, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
    ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           _ui_theme_color_Transparent);
    ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Transparent);
    ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BORDER_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BORDER_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_grindButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
    lv_imgbtn_set_src(ui_MenuScreen_grindButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_363557387, NULL);
    lv_obj_set_width(ui_MenuScreen_grindButton1, 80);
    lv_obj_set_height(ui_MenuScreen_grindButton1, 80);
    lv_obj_set_x(ui_MenuScreen_grindButton1, -70);
    lv_obj_set_y(ui_MenuScreen_grindButton1, -70);
    lv_obj_set_align(ui_MenuScreen_grindButton1, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(ui_MenuScreen_grindButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_grindButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_brewButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
    lv_imgbtn_set_src(ui_MenuScreen_brewButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_979979123, NULL);
    lv_obj_set_width(ui_MenuScreen_brewButton1, 80);
    lv_obj_set_height(ui_MenuScreen_brewButton1, 80);
    lv_obj_set_x(ui_MenuScreen_brewButton1, 70);
    lv_obj_set_y(ui_MenuScreen_brewButton1, -70);
    lv_obj_set_align(ui_MenuScreen_brewButton1, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(ui_MenuScreen_brewButton1, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_brewButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_profileButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
    lv_imgbtn_set_src(ui_MenuScreen_profileButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_545340440, NULL);
    lv_obj_set_width(ui_MenuScreen_profileButton1, 80);
    lv_obj_set_height(ui_MenuScreen_profileButton1, 80);
    lv_obj_set_x(ui_MenuScreen_profileButton1, -70);
    lv_obj_set_y(ui_MenuScreen_profileButton1, 70);
    lv_obj_set_align(ui_MenuScreen_profileButton1, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(ui_MenuScreen_profileButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_profileButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_extrasButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
    lv_imgbtn_set_src(ui_MenuScreen_extrasButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_783005998, NULL);
    lv_obj_set_width(ui_MenuScreen_extrasButton1, 80);
    lv_obj_set_height(ui_MenuScreen_extrasButton1, 80);
    lv_obj_set_x(ui_MenuScreen_extrasButton1, 70);
    lv_obj_set_y(ui_MenuScreen_extrasButton1, 70);
    lv_obj_set_align(ui_MenuScreen_extrasButton1, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(ui_MenuScreen_extrasButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_extrasButton1, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_MenuScreen_standbyButton = lv_imgbtn_create(ui_MenuScreen);
    lv_imgbtn_set_src(ui_MenuScreen_standbyButton, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_2044104741, NULL);
    lv_obj_set_width(ui_MenuScreen_standbyButton, 40);
    lv_obj_set_height(ui_MenuScreen_standbyButton, 40);
    lv_obj_set_x(ui_MenuScreen_standbyButton, 0);
    lv_obj_set_y(ui_MenuScreen_standbyButton, 210);
    lv_obj_set_align(ui_MenuScreen_standbyButton, LV_ALIGN_CENTER);
    lv_obj_set_style_img_recolor(ui_MenuScreen_standbyButton, lv_color_hex(0xFAFAFA), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_img_recolor_opa(ui_MenuScreen_standbyButton, 255, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_MenuScreen_pressureText = lv_label_create(ui_MenuScreen);
    lv_obj_set_width(ui_MenuScreen_pressureText, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_MenuScreen_pressureText, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_MenuScreen_pressureText, 0);
    lv_obj_set_y(ui_MenuScreen_pressureText, 192);
    lv_obj_set_align(ui_MenuScreen_pressureText, LV_ALIGN_CENTER);
    lv_label_set_text(ui_MenuScreen_pressureText, "9 bar");
    lv_obj_add_flag(ui_MenuScreen_pressureText, LV_OBJ_FLAG_HIDDEN);     /// Flags
    ui_object_set_themeable_style_property(ui_MenuScreen_pressureText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_pressureText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA,
                                           _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_MenuScreen_pressureText, &lv_font_montserrat_18, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_MenuScreen_tempText = lv_label_create(ui_MenuScreen);
    lv_obj_set_width(ui_MenuScreen_tempText, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_MenuScreen_tempText, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_MenuScreen_tempText, 0);
    lv_obj_set_y(ui_MenuScreen_tempText, -180);
    lv_obj_set_align(ui_MenuScreen_tempText, LV_ALIGN_CENTER);
    lv_label_set_text(ui_MenuScreen_tempText, "92°C");
    ui_object_set_themeable_style_property(ui_MenuScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_MenuScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA,
                                           _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_MenuScreen_tempText, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
    ui_object_set_themeable_style_property(ui_MenuScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(ui_MenuScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Dark);
    lv_obj_set_style_pad_left(ui_MenuScreen_tempText, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_right(ui_MenuScreen_tempText, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_top(ui_MenuScreen_tempText, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_bottom(ui_MenuScreen_tempText, 0, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_add_event_cb(ui_MenuScreen_grindButton1, ui_event_MenuScreen_grindButton1, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_MenuScreen_brewButton1, ui_event_MenuScreen_brewButton1, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_MenuScreen_profileButton1, ui_event_MenuScreen_profileButton1, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_MenuScreen_extrasButton1, ui_event_MenuScreen_extrasButton1, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_MenuScreen_standbyButton, ui_event_MenuScreen_standbyButton, LV_EVENT_ALL, NULL);

}