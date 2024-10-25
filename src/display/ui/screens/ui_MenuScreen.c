// This file was generated by SquareLine Studio
// SquareLine Studio version: SquareLine Studio 1.4.0
// LVGL version: 8.3.11
// Project name: Gaggiuino

#include "../ui.h"

void ui_MenuScreen_screen_init(void)
{
ui_MenuScreen = lv_obj_create(NULL);
lv_obj_clear_flag( ui_MenuScreen, LV_OBJ_FLAG_SCROLLABLE );    /// Flags
ui_object_set_themeable_style_property(ui_MenuScreen, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_COLOR, _ui_theme_color_Dark);
ui_object_set_themeable_style_property(ui_MenuScreen, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_OPA, _ui_theme_alpha_Dark);

ui_MenuScreen_tempGauge = lv_arc_create(ui_MenuScreen);
lv_obj_set_width( ui_MenuScreen_tempGauge, 440);
lv_obj_set_height( ui_MenuScreen_tempGauge, 440);
lv_obj_set_align( ui_MenuScreen_tempGauge, LV_ALIGN_CENTER );
lv_obj_add_state( ui_MenuScreen_tempGauge, LV_STATE_DISABLED );     /// States
lv_arc_set_range(ui_MenuScreen_tempGauge, 0,150);
lv_arc_set_value(ui_MenuScreen_tempGauge, 92);
lv_arc_set_bg_angles(ui_MenuScreen_tempGauge,110,70);
lv_obj_set_style_arc_width(ui_MenuScreen_tempGauge, 8, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_set_style_arc_color(ui_MenuScreen_tempGauge, lv_color_hex(0xFF4E4E), LV_PART_INDICATOR | LV_STATE_DEFAULT );
lv_obj_set_style_arc_opa(ui_MenuScreen_tempGauge, 255, LV_PART_INDICATOR| LV_STATE_DEFAULT);
lv_obj_set_style_arc_width(ui_MenuScreen_tempGauge, 8, LV_PART_INDICATOR| LV_STATE_DEFAULT);

lv_obj_set_style_bg_color(ui_MenuScreen_tempGauge, lv_color_hex(0xD10000), LV_PART_KNOB | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_MenuScreen_tempGauge, 0, LV_PART_KNOB| LV_STATE_DEFAULT);

ui_MenuScreen_tempTarget = lv_arc_create(ui_MenuScreen);
lv_obj_set_width( ui_MenuScreen_tempTarget, 440);
lv_obj_set_height( ui_MenuScreen_tempTarget, 440);
lv_obj_set_align( ui_MenuScreen_tempTarget, LV_ALIGN_CENTER );
lv_obj_add_state( ui_MenuScreen_tempTarget, LV_STATE_DISABLED );     /// States
lv_arc_set_range(ui_MenuScreen_tempTarget, 0,150);
lv_arc_set_value(ui_MenuScreen_tempTarget, 90);
lv_arc_set_bg_angles(ui_MenuScreen_tempTarget,110,70);
lv_obj_set_style_bg_color(ui_MenuScreen_tempTarget, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_MenuScreen_tempTarget, 0, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_arc_color(ui_MenuScreen_tempTarget, lv_color_hex(0x4040FF), LV_PART_MAIN | LV_STATE_DEFAULT );
lv_obj_set_style_arc_opa(ui_MenuScreen_tempTarget, 0, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_arc_width(ui_MenuScreen_tempTarget, 8, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_set_style_bg_color(ui_MenuScreen_tempTarget, lv_color_hex(0xFFFFFF), LV_PART_INDICATOR | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_MenuScreen_tempTarget, 0, LV_PART_INDICATOR| LV_STATE_DEFAULT);
lv_obj_set_style_arc_color(ui_MenuScreen_tempTarget, lv_color_hex(0xFF4E4E), LV_PART_INDICATOR | LV_STATE_DEFAULT );
lv_obj_set_style_arc_opa(ui_MenuScreen_tempTarget, 0, LV_PART_INDICATOR| LV_STATE_DEFAULT);
lv_obj_set_style_arc_width(ui_MenuScreen_tempTarget, 8, LV_PART_INDICATOR| LV_STATE_DEFAULT);

lv_obj_set_style_bg_color(ui_MenuScreen_tempTarget, lv_color_hex(0xFF0000), LV_PART_KNOB | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_MenuScreen_tempTarget, 255, LV_PART_KNOB| LV_STATE_DEFAULT);

ui_MenuScreen_tempText = lv_label_create(ui_MenuScreen);
lv_obj_set_width( ui_MenuScreen_tempText, LV_SIZE_CONTENT);  /// 1
lv_obj_set_height( ui_MenuScreen_tempText, LV_SIZE_CONTENT);   /// 1
lv_obj_set_x( ui_MenuScreen_tempText, 0 );
lv_obj_set_y( ui_MenuScreen_tempText, -196 );
lv_obj_set_align( ui_MenuScreen_tempText, LV_ALIGN_CENTER );
lv_label_set_text(ui_MenuScreen_tempText,"92°C");
lv_obj_set_style_text_color(ui_MenuScreen_tempText, lv_color_hex(0xFAFAFA), LV_PART_MAIN | LV_STATE_DEFAULT );
lv_obj_set_style_text_opa(ui_MenuScreen_tempText, 255, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_text_font(ui_MenuScreen_tempText, &lv_font_montserrat_18, LV_PART_MAIN| LV_STATE_DEFAULT);

ui_MenuScreen_contentPanel1 = lv_obj_create(ui_MenuScreen);
lv_obj_set_width( ui_MenuScreen_contentPanel1, 360);
lv_obj_set_height( ui_MenuScreen_contentPanel1, 360);
lv_obj_set_align( ui_MenuScreen_contentPanel1, LV_ALIGN_CENTER );
lv_obj_clear_flag( ui_MenuScreen_contentPanel1, LV_OBJ_FLAG_SCROLLABLE );    /// Flags
lv_obj_set_style_radius(ui_MenuScreen_contentPanel1, 180, LV_PART_MAIN| LV_STATE_DEFAULT);
ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_COLOR, _ui_theme_color_Transparent);
ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_OPA, _ui_theme_alpha_Transparent);
ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BORDER_COLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_MenuScreen_contentPanel1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BORDER_OPA, _ui_theme_alpha_NiceWhite);

ui_MenuScreen_grindButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
lv_imgbtn_set_src(ui_MenuScreen_grindButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_1857452635, NULL);
lv_obj_set_width( ui_MenuScreen_grindButton1, 80);
lv_obj_set_height( ui_MenuScreen_grindButton1, 80);
lv_obj_set_x( ui_MenuScreen_grindButton1, -70 );
lv_obj_set_y( ui_MenuScreen_grindButton1, -70 );
lv_obj_set_align( ui_MenuScreen_grindButton1, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_MenuScreen_grindButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_SemiDark);
ui_object_set_themeable_style_property(ui_MenuScreen_grindButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_SemiDark);

ui_MenuScreen_brewButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
lv_imgbtn_set_src(ui_MenuScreen_brewButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_753040508, NULL);
lv_obj_set_width( ui_MenuScreen_brewButton1, 80);
lv_obj_set_height( ui_MenuScreen_brewButton1, 80);
lv_obj_set_x( ui_MenuScreen_brewButton1, 70 );
lv_obj_set_y( ui_MenuScreen_brewButton1, -70 );
lv_obj_set_align( ui_MenuScreen_brewButton1, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_MenuScreen_brewButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_MenuScreen_brewButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

ui_MenuScreen_profileButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
lv_imgbtn_set_src(ui_MenuScreen_profileButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_2100879889, NULL);
lv_obj_set_width( ui_MenuScreen_profileButton1, 80);
lv_obj_set_height( ui_MenuScreen_profileButton1, 80);
lv_obj_set_x( ui_MenuScreen_profileButton1, -70 );
lv_obj_set_y( ui_MenuScreen_profileButton1, 70 );
lv_obj_set_align( ui_MenuScreen_profileButton1, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_MenuScreen_profileButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_MenuScreen_profileButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

ui_MenuScreen_extrasButton1 = lv_imgbtn_create(ui_MenuScreen_contentPanel1);
lv_imgbtn_set_src(ui_MenuScreen_extrasButton1, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_2056842146, NULL);
lv_obj_set_width( ui_MenuScreen_extrasButton1, 80);
lv_obj_set_height( ui_MenuScreen_extrasButton1, 80);
lv_obj_set_x( ui_MenuScreen_extrasButton1, 70 );
lv_obj_set_y( ui_MenuScreen_extrasButton1, 70 );
lv_obj_set_align( ui_MenuScreen_extrasButton1, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_MenuScreen_extrasButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_MenuScreen_extrasButton1, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

ui_MenuScreen_mainLabel4 = lv_label_create(ui_MenuScreen_contentPanel1);
lv_obj_set_width( ui_MenuScreen_mainLabel4, LV_SIZE_CONTENT);  /// 1
lv_obj_set_height( ui_MenuScreen_mainLabel4, LV_SIZE_CONTENT);   /// 1
lv_obj_set_x( ui_MenuScreen_mainLabel4, 0 );
lv_obj_set_y( ui_MenuScreen_mainLabel4, -160 );
lv_obj_set_align( ui_MenuScreen_mainLabel4, LV_ALIGN_CENTER );
lv_label_set_text(ui_MenuScreen_mainLabel4,"Menu");
ui_object_set_themeable_style_property(ui_MenuScreen_mainLabel4, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_MenuScreen_mainLabel4, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
lv_obj_set_style_text_font(ui_MenuScreen_mainLabel4, &lv_font_montserrat_18, LV_PART_MAIN| LV_STATE_DEFAULT);

ui_MenuScreen_standbyButton = lv_imgbtn_create(ui_MenuScreen);
lv_imgbtn_set_src(ui_MenuScreen_standbyButton, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_standby_png, NULL);
lv_obj_set_width( ui_MenuScreen_standbyButton, 40);
lv_obj_set_height( ui_MenuScreen_standbyButton, 40);
lv_obj_set_x( ui_MenuScreen_standbyButton, 0 );
lv_obj_set_y( ui_MenuScreen_standbyButton, 210 );
lv_obj_set_align( ui_MenuScreen_standbyButton, LV_ALIGN_CENTER );
lv_obj_set_style_img_recolor(ui_MenuScreen_standbyButton, lv_color_hex(0xFAFAFA), LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_img_recolor_opa(ui_MenuScreen_standbyButton, 255, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_add_event_cb(ui_MenuScreen_brewButton1, ui_event_MenuScreen_brewButton1, LV_EVENT_ALL, NULL);
lv_obj_add_event_cb(ui_MenuScreen_profileButton1, ui_event_MenuScreen_profileButton1, LV_EVENT_ALL, NULL);
lv_obj_add_event_cb(ui_MenuScreen_extrasButton1, ui_event_MenuScreen_extrasButton1, LV_EVENT_ALL, NULL);
lv_obj_add_event_cb(ui_MenuScreen_standbyButton, ui_event_MenuScreen_standbyButton, LV_EVENT_ALL, NULL);

}