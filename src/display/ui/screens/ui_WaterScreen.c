// This file was generated by SquareLine Studio
// SquareLine Studio version: SquareLine Studio 1.4.0
// LVGL version: 8.3.11
// Project name: Gaggiuino

#include "../ui.h"

void ui_WaterScreen_screen_init(void)
{
ui_WaterScreen = lv_obj_create(NULL);
lv_obj_clear_flag( ui_WaterScreen, LV_OBJ_FLAG_SCROLLABLE );    /// Flags
ui_object_set_themeable_style_property(ui_WaterScreen, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_COLOR, _ui_theme_color_Dark);
ui_object_set_themeable_style_property(ui_WaterScreen, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_OPA, _ui_theme_alpha_Dark);

ui_WaterScreen_tempGauge = lv_arc_create(ui_WaterScreen);
lv_obj_set_width( ui_WaterScreen_tempGauge, 440);
lv_obj_set_height( ui_WaterScreen_tempGauge, 440);
lv_obj_set_align( ui_WaterScreen_tempGauge, LV_ALIGN_CENTER );
lv_arc_set_range(ui_WaterScreen_tempGauge, 0,150);
lv_arc_set_value(ui_WaterScreen_tempGauge, 92);
lv_arc_set_bg_angles(ui_WaterScreen_tempGauge,110,70);
lv_obj_set_style_arc_width(ui_WaterScreen_tempGauge, 8, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_set_style_arc_color(ui_WaterScreen_tempGauge, lv_color_hex(0xFF4E4E), LV_PART_INDICATOR | LV_STATE_DEFAULT );
lv_obj_set_style_arc_opa(ui_WaterScreen_tempGauge, 255, LV_PART_INDICATOR| LV_STATE_DEFAULT);
lv_obj_set_style_arc_width(ui_WaterScreen_tempGauge, 8, LV_PART_INDICATOR| LV_STATE_DEFAULT);

lv_obj_set_style_bg_color(ui_WaterScreen_tempGauge, lv_color_hex(0xD10000), LV_PART_KNOB | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_WaterScreen_tempGauge, 0, LV_PART_KNOB| LV_STATE_DEFAULT);

ui_WaterScreen_tempTarget = lv_arc_create(ui_WaterScreen);
lv_obj_set_width( ui_WaterScreen_tempTarget, 440);
lv_obj_set_height( ui_WaterScreen_tempTarget, 440);
lv_obj_set_align( ui_WaterScreen_tempTarget, LV_ALIGN_CENTER );
lv_arc_set_range(ui_WaterScreen_tempTarget, 0,150);
lv_arc_set_value(ui_WaterScreen_tempTarget, 80);
lv_arc_set_bg_angles(ui_WaterScreen_tempTarget,110,70);
lv_obj_set_style_bg_color(ui_WaterScreen_tempTarget, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_WaterScreen_tempTarget, 0, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_arc_color(ui_WaterScreen_tempTarget, lv_color_hex(0x4040FF), LV_PART_MAIN | LV_STATE_DEFAULT );
lv_obj_set_style_arc_opa(ui_WaterScreen_tempTarget, 0, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_arc_width(ui_WaterScreen_tempTarget, 8, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_set_style_bg_color(ui_WaterScreen_tempTarget, lv_color_hex(0xFFFFFF), LV_PART_INDICATOR | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_WaterScreen_tempTarget, 0, LV_PART_INDICATOR| LV_STATE_DEFAULT);
lv_obj_set_style_arc_color(ui_WaterScreen_tempTarget, lv_color_hex(0xFF4E4E), LV_PART_INDICATOR | LV_STATE_DEFAULT );
lv_obj_set_style_arc_opa(ui_WaterScreen_tempTarget, 0, LV_PART_INDICATOR| LV_STATE_DEFAULT);
lv_obj_set_style_arc_width(ui_WaterScreen_tempTarget, 8, LV_PART_INDICATOR| LV_STATE_DEFAULT);

lv_obj_set_style_bg_color(ui_WaterScreen_tempTarget, lv_color_hex(0xFF0000), LV_PART_KNOB | LV_STATE_DEFAULT );
lv_obj_set_style_bg_opa(ui_WaterScreen_tempTarget, 255, LV_PART_KNOB| LV_STATE_DEFAULT);

ui_WaterScreen_ImgButton7 = lv_imgbtn_create(ui_WaterScreen);
lv_imgbtn_set_src(ui_WaterScreen_ImgButton7, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_1895594966, NULL);
lv_obj_set_width( ui_WaterScreen_ImgButton7, 40);
lv_obj_set_height( ui_WaterScreen_ImgButton7, 40);
lv_obj_set_x( ui_WaterScreen_ImgButton7, 0 );
lv_obj_set_y( ui_WaterScreen_ImgButton7, 210 );
lv_obj_set_align( ui_WaterScreen_ImgButton7, LV_ALIGN_CENTER );
lv_obj_set_style_img_recolor(ui_WaterScreen_ImgButton7, lv_color_hex(0xFAFAFA), LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_img_recolor_opa(ui_WaterScreen_ImgButton7, 255, LV_PART_MAIN| LV_STATE_DEFAULT);

ui_WaterScreen_tempText = lv_label_create(ui_WaterScreen);
lv_obj_set_width( ui_WaterScreen_tempText, LV_SIZE_CONTENT);  /// 1
lv_obj_set_height( ui_WaterScreen_tempText, LV_SIZE_CONTENT);   /// 1
lv_obj_set_x( ui_WaterScreen_tempText, 0 );
lv_obj_set_y( ui_WaterScreen_tempText, -196 );
lv_obj_set_align( ui_WaterScreen_tempText, LV_ALIGN_CENTER );
lv_label_set_text(ui_WaterScreen_tempText,"92°C");
lv_obj_set_style_text_color(ui_WaterScreen_tempText, lv_color_hex(0xFAFAFA), LV_PART_MAIN | LV_STATE_DEFAULT );
lv_obj_set_style_text_opa(ui_WaterScreen_tempText, 255, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_text_font(ui_WaterScreen_tempText, &lv_font_montserrat_18, LV_PART_MAIN| LV_STATE_DEFAULT);

ui_WaterScreen_contentPanel6 = lv_obj_create(ui_WaterScreen);
lv_obj_set_width( ui_WaterScreen_contentPanel6, 360);
lv_obj_set_height( ui_WaterScreen_contentPanel6, 360);
lv_obj_set_align( ui_WaterScreen_contentPanel6, LV_ALIGN_CENTER );
lv_obj_clear_flag( ui_WaterScreen_contentPanel6, LV_OBJ_FLAG_SCROLLABLE );    /// Flags
lv_obj_set_style_radius(ui_WaterScreen_contentPanel6, 180, LV_PART_MAIN| LV_STATE_DEFAULT);
ui_object_set_themeable_style_property(ui_WaterScreen_contentPanel6, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_COLOR, _ui_theme_color_Transparent);
ui_object_set_themeable_style_property(ui_WaterScreen_contentPanel6, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BG_OPA, _ui_theme_alpha_Transparent);
ui_object_set_themeable_style_property(ui_WaterScreen_contentPanel6, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BORDER_COLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_contentPanel6, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_BORDER_OPA, _ui_theme_alpha_NiceWhite);

ui_WaterScreen_mainLabel6 = lv_label_create(ui_WaterScreen_contentPanel6);
lv_obj_set_width( ui_WaterScreen_mainLabel6, LV_SIZE_CONTENT);  /// 1
lv_obj_set_height( ui_WaterScreen_mainLabel6, LV_SIZE_CONTENT);   /// 1
lv_obj_set_x( ui_WaterScreen_mainLabel6, 0 );
lv_obj_set_y( ui_WaterScreen_mainLabel6, -160 );
lv_obj_set_align( ui_WaterScreen_mainLabel6, LV_ALIGN_CENTER );
lv_label_set_text(ui_WaterScreen_mainLabel6,"Water");
ui_object_set_themeable_style_property(ui_WaterScreen_mainLabel6, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_mainLabel6, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
lv_obj_set_style_text_font(ui_WaterScreen_mainLabel6, &lv_font_montserrat_18, LV_PART_MAIN| LV_STATE_DEFAULT);

ui_WaterScreen_targetTempHelp3 = lv_label_create(ui_WaterScreen_contentPanel6);
lv_obj_set_width( ui_WaterScreen_targetTempHelp3, LV_SIZE_CONTENT);  /// 1
lv_obj_set_height( ui_WaterScreen_targetTempHelp3, LV_SIZE_CONTENT);   /// 1
lv_obj_set_x( ui_WaterScreen_targetTempHelp3, 0 );
lv_obj_set_y( ui_WaterScreen_targetTempHelp3, -80 );
lv_obj_set_align( ui_WaterScreen_targetTempHelp3, LV_ALIGN_CENTER );
lv_label_set_text(ui_WaterScreen_targetTempHelp3,"Target Temperature");
ui_object_set_themeable_style_property(ui_WaterScreen_targetTempHelp3, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_targetTempHelp3, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
lv_obj_set_style_text_font(ui_WaterScreen_targetTempHelp3, &lv_font_montserrat_12, LV_PART_MAIN| LV_STATE_DEFAULT);

ui_WaterScreen_goButton = lv_imgbtn_create(ui_WaterScreen_contentPanel6);
lv_imgbtn_set_src(ui_WaterScreen_goButton, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_2106667244, NULL);
lv_obj_set_width( ui_WaterScreen_goButton, 40);
lv_obj_set_height( ui_WaterScreen_goButton, 40);
lv_obj_set_x( ui_WaterScreen_goButton, 0 );
lv_obj_set_y( ui_WaterScreen_goButton, 110 );
lv_obj_set_align( ui_WaterScreen_goButton, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_WaterScreen_goButton, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_goButton, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

ui_WaterScreen_downTempButton = lv_imgbtn_create(ui_WaterScreen_contentPanel6);
lv_imgbtn_set_src(ui_WaterScreen_downTempButton, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_980971367, NULL);
lv_obj_set_width( ui_WaterScreen_downTempButton, 40);
lv_obj_set_height( ui_WaterScreen_downTempButton, 40);
lv_obj_set_x( ui_WaterScreen_downTempButton, 0 );
lv_obj_set_y( ui_WaterScreen_downTempButton, 40 );
lv_obj_set_align( ui_WaterScreen_downTempButton, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_WaterScreen_downTempButton, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_downTempButton, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

ui_WaterScreen_upTempButton = lv_imgbtn_create(ui_WaterScreen_contentPanel6);
lv_imgbtn_set_src(ui_WaterScreen_upTempButton, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_1895594966, NULL);
lv_obj_set_width( ui_WaterScreen_upTempButton, 40);
lv_obj_set_height( ui_WaterScreen_upTempButton, 40);
lv_obj_set_x( ui_WaterScreen_upTempButton, 0 );
lv_obj_set_y( ui_WaterScreen_upTempButton, -40 );
lv_obj_set_align( ui_WaterScreen_upTempButton, LV_ALIGN_CENTER );
ui_object_set_themeable_style_property(ui_WaterScreen_upTempButton, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_upTempButton, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

ui_WaterScreen_targetTemp = lv_label_create(ui_WaterScreen_contentPanel6);
lv_obj_set_width( ui_WaterScreen_targetTemp, 60);
lv_obj_set_height( ui_WaterScreen_targetTemp, 20);
lv_obj_set_align( ui_WaterScreen_targetTemp, LV_ALIGN_CENTER );
lv_label_set_text(ui_WaterScreen_targetTemp,"80°C");
ui_object_set_themeable_style_property(ui_WaterScreen_targetTemp, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
ui_object_set_themeable_style_property(ui_WaterScreen_targetTemp, LV_PART_MAIN| LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
lv_obj_set_style_text_align(ui_WaterScreen_targetTemp, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN| LV_STATE_DEFAULT);
lv_obj_set_style_text_font(ui_WaterScreen_targetTemp, &lv_font_montserrat_20, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_add_event_cb(ui_WaterScreen_goButton, ui_event_WaterScreen_goButton, LV_EVENT_ALL, NULL);
lv_obj_add_event_cb(ui_WaterScreen_downTempButton, ui_event_WaterScreen_downTempButton, LV_EVENT_ALL, NULL);
lv_obj_add_event_cb(ui_WaterScreen_upTempButton, ui_event_WaterScreen_upTempButton, LV_EVENT_ALL, NULL);
lv_obj_add_event_cb(ui_WaterScreen, ui_event_WaterScreen, LV_EVENT_ALL, NULL);

}
