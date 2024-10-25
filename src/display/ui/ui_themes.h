// This file was generated by SquareLine Studio
// SquareLine Studio version: SquareLine Studio 1.4.0
// LVGL version: 8.3.11
// Project name: Gaggiuino

#ifndef _UI_THEMES_H
#define _UI_THEMES_H

#ifdef __cplusplus
extern "C" {
#endif

#define UI_THEME_COLOR_NICEWHITE 0
#define UI_THEME_COLOR_DARK 1
#define UI_THEME_COLOR_SEMIDARK 2
#define UI_THEME_COLOR_TRANSPARENT 3

#define UI_THEME_DEFAULT 0

#define UI_THEME_LIGHT 1

extern const ui_theme_variable_t _ui_theme_color_NiceWhite[2];
extern const ui_theme_variable_t _ui_theme_alpha_NiceWhite[2];

extern const ui_theme_variable_t _ui_theme_color_Dark[2];
extern const ui_theme_variable_t _ui_theme_alpha_Dark[2];

extern const ui_theme_variable_t _ui_theme_color_SemiDark[2];
extern const ui_theme_variable_t _ui_theme_alpha_SemiDark[2];

extern const ui_theme_variable_t _ui_theme_color_Transparent[2];
extern const ui_theme_variable_t _ui_theme_alpha_Transparent[2];

extern const uint32_t* ui_theme_colors[2];
extern const uint8_t* ui_theme_alphas[2];
extern uint8_t ui_theme_idx;

void ui_theme_set(uint8_t theme_idx);

#ifdef __cplusplus
} /*extern "C"*/
#endif

#endif