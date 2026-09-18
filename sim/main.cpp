// Offscreen LVGL simulator for the on-device bean-picker screens.
//
// Renders the real generated screens + BeanScreens.cpp into a 480x480 RGB565
// framebuffer, drives them with synthetic touches, dumps frames to out/*.raw
// (sim/png.py turns them into PNGs) and asserts the calls the UI makes into
// the (stubbed) Controller. Exit code != 0 on any failed assertion.
#include "main.h"
#include "BeanScreens.h"
#include "lvgl/ui.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

Controller controller;
unsigned long sim_millis = 0;

namespace {
constexpr int W = 480, H = 480;
uint16_t framebuffer[W * H];
lv_color_t drawBuf[W * 40];
lv_disp_draw_buf_t drawBufDsc;
lv_disp_drv_t dispDrv;
lv_indev_drv_t indevDrv;
bool touchPressed = false;
lv_point_t touchPoint{0, 0};
int failures = 0;
int shotIndex = 0;
std::string outDir = "out";

void flushCb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    for (int y = area->y1; y <= area->y2; y++) {
        for (int x = area->x1; x <= area->x2; x++) {
            framebuffer[y * W + x] = color_p->full;
            color_p++;
        }
    }
    lv_disp_flush_ready(drv);
}

void touchReadCb(lv_indev_drv_t *, lv_indev_data_t *data) {
    data->state = touchPressed ? LV_INDEV_STATE_PRESSED : LV_INDEV_STATE_RELEASED;
    data->point = touchPoint;
}

// Same as DefaultUI::handleScreenChange(): load the target, delete the old one.
void handleScreenChange() {
    SimUI *ui = controller.getUI();
    if (!ui->targetScreen)
        return;
    lv_obj_t *current = lv_scr_act();
    if (current != *ui->targetScreen) {
        _ui_screen_change(ui->targetScreen, LV_SCR_LOAD_ANIM_NONE, 0, 0, ui->targetInit);
        // The screens delete themselves on LV_EVENT_SCREEN_UNLOADED (scr_unloaded_delete_cb),
        // so by now `current` is normally gone already - upstream v1.8.1 deleted it a second
        // time here; with LVGL asserts on that traps, hence the guard (mirrored in DefaultUI).
        if (lv_obj_is_valid(current))
            lv_obj_del(current);
    }
}

void pump(int ms) {
    for (int i = 0; i < ms; i += 5) {
        sim_millis += 5;
        lv_tick_inc(5);
        lv_timer_handler();
        handleScreenChange();
    }
}

void tapAt(lv_coord_t x, lv_coord_t y) {
    touchPoint = {x, y};
    touchPressed = true;
    pump(80);
    touchPressed = false;
    pump(150);
}

void tap(lv_obj_t *obj) {
    if (!obj) {
        printf("  !! tap on NULL object\n");
        failures++;
        return;
    }
    lv_area_t a;
    lv_obj_get_coords(obj, &a);
    tapAt((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2);
}

void shot(const char *name) {
    char path[256];
    snprintf(path, sizeof(path), "%s/%02d-%s.raw", outDir.c_str(), ++shotIndex, name);
    FILE *f = fopen(path, "wb");
    if (!f) {
        perror(path);
        failures++;
        return;
    }
    fwrite(framebuffer, sizeof(framebuffer), 1, f);
    fclose(f);
    printf("  shot %s\n", path);
}

void expect(bool ok, const char *what) {
    printf("  %s %s\n", ok ? "ok " : "FAIL", what);
    if (!ok)
        failures++;
}

lv_obj_t *beanPanel() { return ui_BeanScreen ? lv_obj_get_child(ui_BeanScreen, 1) : nullptr; }
lv_obj_t *beanButton(int i) { return beanPanel() ? lv_obj_get_child(beanPanel(), 1 + i) : nullptr; }
lv_obj_t *grindPanel() { return ui_BeanGrindScreen ? lv_obj_get_child(ui_BeanGrindScreen, 1) : nullptr; }
lv_obj_t *grindChild(int i) { return grindPanel() ? lv_obj_get_child(grindPanel(), i) : nullptr; }
// panel children in BeanGrindScreen: 0 title, 1 subtitle, 2 value, 3 minus, 4 plus, 5 error, 6 confirm
lv_obj_t *grindValue() { return grindChild(2); }
lv_obj_t *grindMinus() { return grindChild(3); }
lv_obj_t *grindPlus() { return grindChild(4); }
lv_obj_t *grindError() { return grindChild(5); }
lv_obj_t *grindConfirm() { return grindChild(6); }

std::string joinCalls() {
    std::string s;
    for (auto &c : controller.calls)
        s += c + " ";
    return s;
}
} // namespace

int main(int argc, char **argv) {
    setvbuf(stdout, nullptr, _IOLBF, 0); // progress visible in logs even if we hang
    if (argc > 1)
        outDir = argv[1];

    lv_init();
    lv_disp_draw_buf_init(&drawBufDsc, drawBuf, nullptr, W * 40);
    lv_disp_drv_init(&dispDrv);
    dispDrv.hor_res = W;
    dispDrv.ver_res = H;
    dispDrv.flush_cb = flushCb;
    dispDrv.draw_buf = &drawBufDsc;
    lv_disp_drv_register(&dispDrv);
    lv_indev_drv_init(&indevDrv);
    indevDrv.type = LV_INDEV_TYPE_POINTER;
    indevDrv.read_cb = touchReadCb;
    lv_indev_drv_register(&indevDrv);

    ui_init();
    ui_theme_set(UI_THEME_DEFAULT);

    // Seed beans like the web UI would have configured them.
    controller.beans.beans = {
        {"b1", "Honduras", "9bar", 14.0f},
        {"b2", "Ethiopie", "adapt", 0.0f},
        {"b3", "Kenya AA Nyeri Washed", "LPtVV8nKXg", 17.5f},
    };

    printf("== 1. menu screen\n");
    controller.getUI()->changeScreen(&ui_MenuScreen, &ui_MenuScreen_screen_init);
    pump(300);
    expect(lv_scr_act() == ui_MenuScreen, "menu screen loaded");
    shot("menu");

    printf("== 2. tap the (former grind) slot -> beans screen\n");
    tap(ui_MenuScreen_grindBtn);
    pump(200);
    expect(lv_scr_act() == ui_BeanScreen, "beans screen loaded");
    expect(beanButton(0) && beanButton(1) && beanButton(2), "three bean buttons present");
    expect(lv_obj_get_child(beanPanel(), 4) == nullptr, "no fourth bean button");
    shot("beans");

    printf("== 3. tap Honduras -> grind prompt defaults to last grind (14.0)\n");
    tap(beanButton(0));
    pump(200);
    expect(lv_scr_act() == ui_BeanGrindScreen, "grind screen loaded");
    expect(grindValue() && strcmp(lv_label_get_text(grindValue()), "14.0") == 0, "grind defaults to 14.0");
    expect(grindError() && lv_obj_has_flag(grindError(), LV_OBJ_FLAG_HIDDEN), "error label hidden");
    shot("grind-default");

    printf("== 4. +0.5 x3, -0.5 x1 -> 15.0\n");
    tap(grindPlus());
    tap(grindPlus());
    tap(grindPlus());
    expect(strcmp(lv_label_get_text(grindValue()), "15.5") == 0, "after 3x plus: 15.5");
    tap(grindMinus());
    expect(strcmp(lv_label_get_text(grindValue()), "15.0") == 0, "after minus: 15.0");
    shot("grind-adjusted");

    printf("== 5. confirm while controller refuses -> error shown, nothing started\n");
    controller.failNext = true;
    controller.calls.clear();
    tap(grindConfirm());
    pump(100);
    expect(!lv_obj_has_flag(grindError(), LV_OBJ_FLAG_HIDDEN), "error label visible");
    expect(strcmp(lv_label_get_text(grindError()), "Controller not connected") == 0, "error text from controller");
    expect(joinCalls() == "startBeanShot(b1,15.000000) ", "only startBeanShot called");
    expect(lv_scr_act() == ui_BeanGrindScreen, "stayed on grind screen");
    shot("grind-error");

    printf("== 6. confirm -> start sequence\n");
    controller.calls.clear();
    tap(grindConfirm());
    pump(100);
    expect(joinCalls() == "startBeanShot(b1,15.000000) selectProfile(9bar) setMode(1) activate ", joinCalls().c_str());
    Bean b;
    controller.beans.find("b1", b);
    expect(b.lastGrind == 15.0f, "bean's last grind updated to 15.0");

    printf("== 7. back to beans, tap Ethiopie (no last grind) -> default 15.0\n");
    controller.getUI()->changeScreen(&ui_BeanScreen, &ui_BeanScreen_screen_init);
    pump(200);
    tap(beanButton(1));
    pump(200);
    expect(lv_scr_act() == ui_BeanGrindScreen, "grind screen for Ethiopie");
    expect(strcmp(lv_label_get_text(grindValue()), "15.0") == 0, "default grind 15.0 when none saved");
    shot("grind-ethiopie");

    printf("== 8. back button -> beans screen; swipe-up alternative not simulated\n");
    tap(lv_obj_get_child(ui_BeanGrindScreen, 2)); // back imgbtn (child 2: dials, panel, back)
    pump(200);
    expect(lv_scr_act() == ui_BeanScreen, "back returns to beans screen");

    printf("== 9. empty state\n");
    controller.beans.beans.clear();
    controller.getUI()->changeScreen(&ui_MenuScreen, &ui_MenuScreen_screen_init);
    pump(200);
    controller.getUI()->changeScreen(&ui_BeanScreen, &ui_BeanScreen_screen_init);
    pump(200);
    expect(lv_scr_act() == ui_BeanScreen, "beans screen (empty)");
    // panel children when empty: 0 title, 1 "No beans" label, nothing else
    lv_obj_t *emptyLabel = lv_obj_get_child(beanPanel(), 1);
    expect(emptyLabel && lv_obj_check_type(emptyLabel, &lv_label_class) &&
               strstr(lv_label_get_text(emptyLabel), "No beans") != nullptr,
           "empty-state label shown");
    expect(lv_obj_get_child(beanPanel(), 2) == nullptr, "no bean buttons when empty");
    shot("beans-empty");

    printf("== 10. four beans fit\n");
    controller.beans.beans = {
        {"b1", "Honduras", "9bar", 14.0f},
        {"b2", "Ethiopie", "adapt", 0.0f},
        {"b3", "Kenya AA", "x", 17.5f},
        {"b4", "Brazil Cerrado", "y", 12.0f},
    };
    controller.getUI()->changeScreen(&ui_MenuScreen, &ui_MenuScreen_screen_init);
    pump(200);
    controller.getUI()->changeScreen(&ui_BeanScreen, &ui_BeanScreen_screen_init);
    pump(200);
    expect(beanButton(3) != nullptr, "fourth bean button present");
    shot("beans-four");

    printf("\n%s (%d failures)\n", failures ? "FAILED" : "ALL OK", failures);
    return failures ? 1 : 0;
}
