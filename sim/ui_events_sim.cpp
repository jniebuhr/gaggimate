// Simulator implementations of the ui_events callbacks that matter for the
// bean-picker flow (everything else is generated as a no-op stub).
#include "main.h"
#include "BeanScreens.h"
#include "lvgl/ui.h"

extern "C" {

void onMenuClick(lv_event_t *e) {
    controller.deactivate();
    controller.setMode(MODE_BREW);
    controller.getUI()->changeScreen(&ui_MenuScreen, &ui_MenuScreen_screen_init);
}

// Mirrors src/display/ui/default/lvgl/ui_events.cpp
void onBeanScreen(lv_event_t *e) {
    controller.deactivate();
    controller.setMode(MODE_BREW);
    controller.getUI()->changeScreen(&ui_BeanScreen, &ui_BeanScreen_screen_init);
}

void onGrindScreen(lv_event_t *e) {
    controller.getUI()->changeScreen(&ui_GrindScreen, &ui_GrindScreen_screen_init);
    controller.setMode(MODE_GRIND);
}

void onBrewScreen(lv_event_t *e) {
    controller.getUI()->changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init);
    controller.setMode(MODE_BREW);
}

void onSteamScreen(lv_event_t *e) {
    controller.getUI()->changeScreen(&ui_SimpleProcessScreen, &ui_SimpleProcessScreen_screen_init);
    controller.setMode(MODE_STEAM);
}

void onWaterScreen(lv_event_t *e) {
    controller.getUI()->changeScreen(&ui_SimpleProcessScreen, &ui_SimpleProcessScreen_screen_init);
    controller.setMode(MODE_WATER);
}

void onStandby(lv_event_t *e) { controller.getUI()->changeScreen(&ui_StandbyScreen, &ui_StandbyScreen_screen_init); }

void onWakeup(lv_event_t *e) { controller.getUI()->changeScreen(&ui_BrewScreen, &ui_BrewScreen_screen_init); }
}
