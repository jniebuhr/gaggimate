#include "actions.h"
#include "screens.h"
#include "ui.h"
#include <Arduino.h>
#include <display/main.h>
#include <display/plugins/BLEScalePlugin.h>

void action_on_wakeup(lv_event_t *e) {
    if (controller.isUpdating() || controller.isErrorState() || controller.isAutotuning() ||
        !controller.getClientController()->isConnected()) {
        return;
    }
    controller.getUI()->changeScreen(SCREEN_ID_BREW_SCREEN);
    controller.deactivate();
    controller.setMode(MODE_BREW);
};

void action_on_load_started(lv_event_t *e) {

};

void action_on_menu_click(lv_event_t *e) {
    controller.deactivate();
    controller.setMode(MODE_BREW);
    controller.getUI()->changeScreen(SCREEN_ID_MENU_SCREEN);
};

void action_on_menu_screen_load(lv_event_t *e) {

};

void action_on_brew_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_BREW_SCREEN);
    controller.deactivate();
    controller.setMode(MODE_BREW);
};

void action_on_steam_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_STEAM_SCREEN);
    controller.setMode(MODE_STEAM);
    controller.deactivate();
};

void action_on_water_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_WATER_SCREEN);
    controller.setMode(MODE_WATER);
    controller.deactivate();
};

void action_on_grind_screen(lv_event_t *e) {
    controller.getUI()->changeScreen(SCREEN_ID_GRIND_SCREEN);
    controller.setMode(MODE_GRIND);
    controller.deactivate();
};

void action_on_brew_start(lv_event_t *e) { controller.activate(); };

void action_on_flush(lv_event_t *e) { controller.onFlush(); };

void action_on_volumetric_hold(lv_event_t *e) {
    controller.getClientController()->tare();
    BLEScales.tare();
};

void action_on_profile_select(lv_event_t *e) { controller.getUI()->onProfileSwitch(); };

void action_on_profile_settings(lv_event_t *e) { controller.getUI()->changeBrewScreenMode(BrewScreenState::Settings); };

void action_on_brew_temp_lower(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.lowerTemp();
};

void action_on_brew_temp_raise(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.raiseTemp();
};

void action_on_brew_time_raise(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.raiseBrewTarget();
};

void action_on_brew_time_lower(lv_event_t *e) {
    controller.getUI()->markProfileDirty();
    controller.lowerBrewTarget();
};

void action_on_volumetric_delete(lv_event_t *e) { controller.getUI()->onVolumetricDelete(); };

void action_on_profile_accept(lv_event_t *e) { controller.getUI()->changeBrewScreenMode(BrewScreenState::Brew); };

void action_on_profile_save(lv_event_t *e) {

    controller.onProfileSave();
    controller.getUI()->markProfileClean();
    controller.getUI()->changeBrewScreenMode(BrewScreenState::Brew);
};

void action_on_profile_save_as_new(lv_event_t *e) {

    controller.onProfileSaveAsNew();
    controller.getUI()->markProfileClean();
    controller.getUI()->changeBrewScreenMode(BrewScreenState::Brew);
};

void action_on_meter_draw(lv_event_t *e) {

};

void action_on_steam_temp_lower(lv_event_t *e) { controller.lowerTemp(); };

void action_on_steam_temp_raise(lv_event_t *e) { controller.raiseTemp(); };

void action_on_grind_time_lower(lv_event_t *e) { controller.lowerGrindTarget(); };

void action_on_grind_time_raise(lv_event_t *e) { controller.raiseGrindTarget(); };

void action_on_timed_click(lv_event_t *e) {

};

void action_on_volumetric_click(lv_event_t *e) {

};

void action_on_grind_toggle(lv_event_t *e) {
    controller.isGrindActive() ? controller.deactivateGrind() : controller.activateGrind();
};

void action_on_simple_process_toggle(lv_event_t *e) {
    if (controller.getMode() != MODE_STEAM) {
        controller.isActive() ? controller.deactivate() : controller.activate();
    }
};

void action_on_profile_load(lv_event_t *e) { controller.getUI()->onProfileSelect(); };

void action_on_previous_profile(lv_event_t *e) { controller.getUI()->onPreviousProfile(); };

void action_on_next_profile(lv_event_t *e) { controller.getUI()->onNextProfile(); };
