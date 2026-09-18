#ifndef BEANSCREENS_H
#define BEANSCREENS_H

// Hand-built LVGL screens for the bean picker. They follow the structure of
// the SquareLine-generated screens (see lvgl/screens/ui_GrindScreen.c) so
// DefaultUI::changeScreen()/handleScreenChange() treat them identically:
// a global lv_obj_t* that is NULL while unloaded, a *_screen_init() that
// creates it, and a *_screen_destroy() wired to LV_EVENT_SCREEN_UNLOADED.

#include "lvgl/ui.h"

#ifdef __cplusplus
extern "C" {
#endif

// Screen 1: list of beans (max 4)
extern lv_obj_t *ui_BeanScreen;
extern lv_obj_t *ui_BeanScreen_dials;
extern lv_obj_t *uic_BeanScreen_dials_tempGauge;
extern lv_obj_t *uic_BeanScreen_dials_tempText;
void ui_BeanScreen_screen_init(void);
void ui_BeanScreen_screen_destroy(void);

// Screen 2: grind-size prompt for the tapped bean
extern lv_obj_t *ui_BeanGrindScreen;
extern lv_obj_t *ui_BeanGrindScreen_dials;
extern lv_obj_t *uic_BeanGrindScreen_dials_tempGauge;
extern lv_obj_t *uic_BeanGrindScreen_dials_tempText;
void ui_BeanGrindScreen_screen_init(void);
void ui_BeanGrindScreen_screen_destroy(void);

#ifdef __cplusplus
}
#endif

#endif // BEANSCREENS_H
