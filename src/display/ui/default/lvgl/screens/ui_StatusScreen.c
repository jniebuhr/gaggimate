// This file was generated by SquareLine Studio
// SquareLine Studio version: SquareLine Studio 1.5.0
// LVGL version: 8.3.11
// Project name: GaggiMate

#include "../ui.h"

void ui_StatusScreen_screen_init(void)
{
    ui_StatusScreen = lv_obj_create(NULL);
    lv_obj_clear_flag(ui_StatusScreen, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    ui_object_set_themeable_style_property(ui_StatusScreen, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(ui_StatusScreen, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Dark);

    ui_StatusScreen_tempTarget = lv_img_create(ui_StatusScreen);
    lv_img_set_src(ui_StatusScreen_tempTarget, &ui_img_indicator_png);
    lv_obj_set_width(ui_StatusScreen_tempTarget, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_tempTarget, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_align(ui_StatusScreen_tempTarget, LV_ALIGN_CENTER);
    lv_obj_add_flag(ui_StatusScreen_tempTarget, LV_OBJ_FLAG_ADV_HITTEST);     /// Flags
    lv_obj_clear_flag(ui_StatusScreen_tempTarget, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    lv_img_set_angle(ui_StatusScreen_tempTarget, 300);
    ui_object_set_themeable_style_property(ui_StatusScreen_tempTarget, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_tempTarget, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_StatusScreen_tempGauge = lv_arc_create(ui_StatusScreen);
    lv_obj_set_width(ui_StatusScreen_tempGauge, 480);
    lv_obj_set_height(ui_StatusScreen_tempGauge, 480);
    lv_obj_set_align(ui_StatusScreen_tempGauge, LV_ALIGN_CENTER);
    lv_obj_add_state(ui_StatusScreen_tempGauge, LV_STATE_DISABLED);       /// States
    lv_arc_set_range(ui_StatusScreen_tempGauge, 0, 160);
    lv_arc_set_value(ui_StatusScreen_tempGauge, 91);
    lv_arc_set_bg_angles(ui_StatusScreen_tempGauge, 112, 68);
    lv_obj_set_style_arc_width(ui_StatusScreen_tempGauge, 35, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(ui_StatusScreen_tempGauge, false, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_img_src(ui_StatusScreen_tempGauge, &ui_img_untitled_png, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_set_style_arc_width(ui_StatusScreen_tempGauge, 35, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_rounded(ui_StatusScreen_tempGauge, false, LV_PART_INDICATOR | LV_STATE_DEFAULT);
    lv_obj_set_style_arc_img_src(ui_StatusScreen_tempGauge, &ui_img_489054950, LV_PART_INDICATOR | LV_STATE_DEFAULT);

    lv_obj_set_style_bg_color(ui_StatusScreen_tempGauge, lv_color_hex(0xD10000), LV_PART_KNOB | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(ui_StatusScreen_tempGauge, 0, LV_PART_KNOB | LV_STATE_DEFAULT);

    ui_StatusScreen_ImgButton3 = lv_imgbtn_create(ui_StatusScreen);
    lv_imgbtn_set_src(ui_StatusScreen_ImgButton3, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_295763949, NULL);
    lv_obj_set_width(ui_StatusScreen_ImgButton3, 40);
    lv_obj_set_height(ui_StatusScreen_ImgButton3, 40);
    lv_obj_set_x(ui_StatusScreen_ImgButton3, 0);
    lv_obj_set_y(ui_StatusScreen_ImgButton3, 210);
    lv_obj_set_align(ui_StatusScreen_ImgButton3, LV_ALIGN_CENTER);
    lv_obj_set_style_img_recolor(ui_StatusScreen_ImgButton3, lv_color_hex(0xFAFAFA), LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_img_recolor_opa(ui_StatusScreen_ImgButton3, 255, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_StatusScreen_contentPanel2 = lv_obj_create(ui_StatusScreen);
    lv_obj_set_width(ui_StatusScreen_contentPanel2, 360);
    lv_obj_set_height(ui_StatusScreen_contentPanel2, 360);
    lv_obj_set_align(ui_StatusScreen_contentPanel2, LV_ALIGN_CENTER);
    lv_obj_clear_flag(ui_StatusScreen_contentPanel2, LV_OBJ_FLAG_SCROLLABLE);      /// Flags
    lv_obj_set_style_radius(ui_StatusScreen_contentPanel2, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
    ui_object_set_themeable_style_property(ui_StatusScreen_contentPanel2, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BG_COLOR, _ui_theme_color_Transparent);
    ui_object_set_themeable_style_property(ui_StatusScreen_contentPanel2, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Transparent);
    ui_object_set_themeable_style_property(ui_StatusScreen_contentPanel2, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BORDER_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_contentPanel2, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_BORDER_OPA, _ui_theme_alpha_NiceWhite);

    ui_StatusScreen_mainLabel1 = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(ui_StatusScreen_mainLabel1, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_mainLabel1, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_mainLabel1, 0);
    lv_obj_set_y(ui_StatusScreen_mainLabel1, -140);
    lv_obj_set_align(ui_StatusScreen_mainLabel1, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_mainLabel1, "Brew");
    ui_object_set_themeable_style_property(ui_StatusScreen_mainLabel1, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_mainLabel1, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA,
                                           _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_StatusScreen_mainLabel1, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_StatusScreen_progressBar = lv_bar_create(ui_StatusScreen_contentPanel2);
    lv_bar_set_range(ui_StatusScreen_progressBar, 0, 36);
    lv_bar_set_value(ui_StatusScreen_progressBar, 20, LV_ANIM_OFF);
    lv_bar_set_start_value(ui_StatusScreen_progressBar, 0, LV_ANIM_OFF);
    lv_obj_set_width(ui_StatusScreen_progressBar, 180);
    lv_obj_set_height(ui_StatusScreen_progressBar, 10);
    lv_obj_set_x(ui_StatusScreen_progressBar, 0);
    lv_obj_set_y(ui_StatusScreen_progressBar, 60);
    lv_obj_set_align(ui_StatusScreen_progressBar, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(ui_StatusScreen_progressBar, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           _ui_theme_color_Transparent);
    ui_object_set_themeable_style_property(ui_StatusScreen_progressBar, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Transparent);
    ui_object_set_themeable_style_property(ui_StatusScreen_progressBar, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_OUTLINE_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_progressBar, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_OUTLINE_OPA, _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_outline_width(ui_StatusScreen_progressBar, 1, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_outline_pad(ui_StatusScreen_progressBar, 3, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_object_set_themeable_style_property(ui_StatusScreen_progressBar, LV_PART_INDICATOR | LV_STATE_DEFAULT,
                                           LV_STYLE_BG_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_progressBar, LV_PART_INDICATOR | LV_STATE_DEFAULT,
                                           LV_STYLE_BG_OPA, _ui_theme_alpha_NiceWhite);

    ui_StatusScreen_progressLabel = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(ui_StatusScreen_progressLabel, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_progressLabel, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_progressLabel, 0);
    lv_obj_set_y(ui_StatusScreen_progressLabel, 30);
    lv_obj_set_align(ui_StatusScreen_progressLabel, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_progressLabel, "0:15 / 0:30");
    ui_object_set_themeable_style_property(ui_StatusScreen_progressLabel, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_progressLabel, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);

    ui_StatusScreen_targetTempHelp = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(ui_StatusScreen_targetTempHelp, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_targetTempHelp, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_targetTempHelp, -80);
    lv_obj_set_y(ui_StatusScreen_targetTempHelp, -80);
    lv_obj_set_align(ui_StatusScreen_targetTempHelp, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_targetTempHelp, "Target Temperature");
    ui_object_set_themeable_style_property(ui_StatusScreen_targetTempHelp, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_targetTempHelp, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_StatusScreen_targetTempHelp, &lv_font_montserrat_12, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_StatusScreen_targetDurationHelp = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(ui_StatusScreen_targetDurationHelp, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_targetDurationHelp, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_targetDurationHelp, 80);
    lv_obj_set_y(ui_StatusScreen_targetDurationHelp, -80);
    lv_obj_set_align(ui_StatusScreen_targetDurationHelp, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_targetDurationHelp, "Target Duration");
    ui_object_set_themeable_style_property(ui_StatusScreen_targetDurationHelp, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_targetDurationHelp, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_StatusScreen_targetDurationHelp, &lv_font_montserrat_12, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_StatusScreen_targetDuration = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(ui_StatusScreen_targetDuration, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_targetDuration, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_targetDuration, 80);
    lv_obj_set_y(ui_StatusScreen_targetDuration, -30);
    lv_obj_set_align(ui_StatusScreen_targetDuration, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_targetDuration, "0:30");
    ui_object_set_themeable_style_property(ui_StatusScreen_targetDuration, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_targetDuration, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_StatusScreen_targetDuration, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_StatusScreen_targetTemp = lv_label_create(ui_StatusScreen_contentPanel2);
    lv_obj_set_width(ui_StatusScreen_targetTemp, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_targetTemp, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_targetTemp, -80);
    lv_obj_set_y(ui_StatusScreen_targetTemp, -30);
    lv_obj_set_align(ui_StatusScreen_targetTemp, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_targetTemp, "93°C");
    ui_object_set_themeable_style_property(ui_StatusScreen_targetTemp, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_targetTemp, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA,
                                           _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_StatusScreen_targetTemp, &lv_font_montserrat_20, LV_PART_MAIN | LV_STATE_DEFAULT);

    ui_StatusScreen_pauseButton = lv_imgbtn_create(ui_StatusScreen_contentPanel2);
    lv_imgbtn_set_src(ui_StatusScreen_pauseButton, LV_IMGBTN_STATE_RELEASED, NULL, &ui_img_1456692430, NULL);
    lv_obj_set_width(ui_StatusScreen_pauseButton, 40);
    lv_obj_set_height(ui_StatusScreen_pauseButton, 40);
    lv_obj_set_x(ui_StatusScreen_pauseButton, 0);
    lv_obj_set_y(ui_StatusScreen_pauseButton, 110);
    lv_obj_set_align(ui_StatusScreen_pauseButton, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(ui_StatusScreen_pauseButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_pauseButton, LV_PART_MAIN | LV_STATE_DEFAULT,
                                           LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);

    ui_StatusScreen_tempText = lv_label_create(ui_StatusScreen);
    lv_obj_set_width(ui_StatusScreen_tempText, LV_SIZE_CONTENT);   /// 1
    lv_obj_set_height(ui_StatusScreen_tempText, LV_SIZE_CONTENT);    /// 1
    lv_obj_set_x(ui_StatusScreen_tempText, 0);
    lv_obj_set_y(ui_StatusScreen_tempText, -180);
    lv_obj_set_align(ui_StatusScreen_tempText, LV_ALIGN_CENTER);
    lv_label_set_text(ui_StatusScreen_tempText, "92°C");
    ui_object_set_themeable_style_property(ui_StatusScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR,
                                           _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(ui_StatusScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA,
                                           _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_font(ui_StatusScreen_tempText, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
    ui_object_set_themeable_style_property(ui_StatusScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR,
                                           _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(ui_StatusScreen_tempText, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA,
                                           _ui_theme_alpha_Dark);
    lv_obj_set_style_pad_left(ui_StatusScreen_tempText, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_right(ui_StatusScreen_tempText, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_top(ui_StatusScreen_tempText, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_pad_bottom(ui_StatusScreen_tempText, 0, LV_PART_MAIN | LV_STATE_DEFAULT);

    lv_obj_add_event_cb(ui_StatusScreen_pauseButton, ui_event_StatusScreen_pauseButton, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_StatusScreen, ui_event_StatusScreen, LV_EVENT_ALL, NULL);

}