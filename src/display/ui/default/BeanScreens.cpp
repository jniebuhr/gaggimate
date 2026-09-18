#include "BeanScreens.h"
#include "../../main.h"
#include <display/core/BeanManager.h>
#include <vector>

// ---------------------------------------------------------------------------
// Shared state between the two screens (LVGL callbacks run on the UI task)
// ---------------------------------------------------------------------------
namespace {
constexpr float GRIND_STEP = 0.5f;
constexpr float GRIND_MIN = 0.0f;
constexpr float GRIND_MAX = 50.0f;
constexpr float GRIND_DEFAULT = 15.0f;

std::vector<Bean> beanList;
int selectedBeanIdx = -1;
float grindValue = GRIND_DEFAULT;

void styleThemedLabel(lv_obj_t *label, const lv_font_t *font) {
    lv_obj_set_width(label, LV_SIZE_CONTENT);
    lv_obj_set_height(label, LV_SIZE_CONTENT);
    ui_object_set_themeable_style_property(label, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_COLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(label, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_TEXT_OPA, _ui_theme_alpha_NiceWhite);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(label, font, LV_PART_MAIN | LV_STATE_DEFAULT);
}

void styleThemedImgBtn(lv_obj_t *btn, const lv_img_dsc_t *img, lv_coord_t x, lv_coord_t y) {
    lv_imgbtn_set_src(btn, LV_IMGBTN_STATE_RELEASED, NULL, img, NULL);
    lv_obj_set_width(btn, 40);
    lv_obj_set_height(btn, 40);
    lv_obj_set_x(btn, x);
    lv_obj_set_y(btn, y);
    lv_obj_set_align(btn, LV_ALIGN_CENTER);
    ui_object_set_themeable_style_property(btn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR, _ui_theme_color_NiceWhite);
    ui_object_set_themeable_style_property(btn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_IMG_RECOLOR_OPA, _ui_theme_alpha_NiceWhite);
}

// Same skeleton as the generated screens: dark themed background, the
// temp/pressure ring, and a transparent 360x360 round content panel.
lv_obj_t *createScreenSkeleton(lv_obj_t **dials, lv_obj_t **panel) {
    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    ui_object_set_themeable_style_property(screen, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR, _ui_theme_color_Dark);
    ui_object_set_themeable_style_property(screen, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA, _ui_theme_alpha_Dark);

    *dials = ui_dials_create(screen);
    lv_obj_set_x(*dials, 0);
    lv_obj_set_y(*dials, 0);

    *panel = lv_obj_create(screen);
    lv_obj_set_width(*panel, 360);
    lv_obj_set_height(*panel, 360);
    lv_obj_set_align(*panel, LV_ALIGN_CENTER);
    lv_obj_clear_flag(*panel, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_radius(*panel, 180, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(*panel, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(*panel, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
    return screen;
}

void formatGrind(lv_obj_t *label) { lv_label_set_text_fmt(label, "%.1f", grindValue); }
} // namespace

// ---------------------------------------------------------------------------
// Screen 1: bean list
// ---------------------------------------------------------------------------
lv_obj_t *ui_BeanScreen = NULL;
lv_obj_t *ui_BeanScreen_dials = NULL;
lv_obj_t *uic_BeanScreen_dials_tempGauge = NULL;
lv_obj_t *uic_BeanScreen_dials_tempText = NULL;
static lv_obj_t *ui_BeanScreen_backBtn = NULL;
static lv_obj_t *ui_BeanScreen_panel = NULL;
static lv_obj_t *ui_BeanScreen_beanBtns[BeanManager::MAX_BEANS] = {NULL, NULL, NULL, NULL};

static void ui_event_BeanScreen(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_GESTURE && lv_indev_get_gesture_dir(lv_indev_get_act()) == LV_DIR_TOP) {
        lv_indev_wait_release(lv_indev_get_act());
        onMenuClick(e);
    }
    if (code == LV_EVENT_SCREEN_LOADED) {
        lv_obj_set_ext_click_area(ui_BeanScreen_backBtn, 20);
    }
}

static void ui_event_BeanScreen_backBtn(lv_event_t *e) {
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        onMenuClick(e);
    }
}

static void ui_event_BeanScreen_beanBtn(lv_event_t *e) {
    if (lv_event_get_code(e) != LV_EVENT_CLICKED) {
        return;
    }
    const int idx = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    if (idx < 0 || idx >= static_cast<int>(beanList.size())) {
        return;
    }
    selectedBeanIdx = idx;
    grindValue = beanList[idx].lastGrind > 0.0f ? beanList[idx].lastGrind : GRIND_DEFAULT;
    controller.getUI()->changeScreen(&ui_BeanGrindScreen, &ui_BeanGrindScreen_screen_init);
}

void ui_BeanScreen_screen_init(void) {
    beanList = controller.getBeanManager()->list();

    ui_BeanScreen = createScreenSkeleton(&ui_BeanScreen_dials, &ui_BeanScreen_panel);
    lv_obj_add_event_cb(ui_BeanScreen, scr_unloaded_delete_cb, LV_EVENT_SCREEN_UNLOADED, (void *)ui_BeanScreen_screen_destroy);

    ui_BeanScreen_backBtn = lv_imgbtn_create(ui_BeanScreen);
    styleThemedImgBtn(ui_BeanScreen_backBtn, &ui_img_295763949, 0, 210);

    lv_obj_t *title = lv_label_create(ui_BeanScreen_panel);
    styleThemedLabel(title, &lv_font_montserrat_24);
    lv_obj_set_align(title, LV_ALIGN_CENTER);
    lv_obj_set_y(title, -140);
    lv_label_set_text(title, "Beans");

    const int n = static_cast<int>(beanList.size());
    if (n == 0) {
        lv_obj_t *empty = lv_label_create(ui_BeanScreen_panel);
        styleThemedLabel(empty, &lv_font_montserrat_18);
        lv_obj_set_align(empty, LV_ALIGN_CENTER);
        lv_label_set_text(empty, "No beans yet.\nAdd them in the web UI.");
    }
    constexpr int ROW = 62;
    const int yStart = 20 - ((n - 1) * ROW) / 2;
    for (int i = 0; i < n && i < BeanManager::MAX_BEANS; i++) {
        lv_obj_t *btn = lv_btn_create(ui_BeanScreen_panel);
        lv_obj_set_width(btn, 260);
        lv_obj_set_height(btn, 52);
        lv_obj_set_align(btn, LV_ALIGN_CENTER);
        lv_obj_set_y(btn, yStart + i * ROW);
        lv_obj_clear_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_radius(btn, 26, LV_PART_MAIN | LV_STATE_DEFAULT);
        lv_obj_set_style_shadow_width(btn, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
        ui_object_set_themeable_style_property(btn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_COLOR, _ui_theme_color_SemiDark);
        ui_object_set_themeable_style_property(btn, LV_PART_MAIN | LV_STATE_DEFAULT, LV_STYLE_BG_OPA, _ui_theme_alpha_SemiDark);
        lv_obj_t *label = lv_label_create(btn);
        styleThemedLabel(label, &lv_font_montserrat_24);
        lv_obj_set_align(label, LV_ALIGN_CENTER);
        // Fixed width AND height: LV_LABEL_LONG_DOT only ellipsizes a fixed-size
        // label; with an auto height a long name would wrap to a second line.
        lv_obj_set_width(label, 230);
        lv_obj_set_height(label, 30);
        lv_label_set_long_mode(label, LV_LABEL_LONG_DOT);
        lv_label_set_text(label, beanList[i].name.c_str());
        lv_obj_add_event_cb(btn, ui_event_BeanScreen_beanBtn, LV_EVENT_ALL, reinterpret_cast<void *>(static_cast<intptr_t>(i)));
        ui_BeanScreen_beanBtns[i] = btn;
    }

    lv_obj_add_event_cb(ui_BeanScreen_backBtn, ui_event_BeanScreen_backBtn, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_BeanScreen, ui_event_BeanScreen, LV_EVENT_ALL, NULL);
    uic_BeanScreen_dials_tempGauge = ui_comp_get_child(ui_BeanScreen_dials, UI_COMP_DIALS_TEMPGAUGE);
    uic_BeanScreen_dials_tempText = ui_comp_get_child(ui_BeanScreen_dials, UI_COMP_DIALS_TEMPTEXT);
}

void ui_BeanScreen_screen_destroy(void) {
    if (ui_BeanScreen)
        lv_obj_del(ui_BeanScreen);
    ui_BeanScreen = NULL;
    ui_BeanScreen_dials = NULL;
    uic_BeanScreen_dials_tempGauge = NULL;
    uic_BeanScreen_dials_tempText = NULL;
    ui_BeanScreen_backBtn = NULL;
    ui_BeanScreen_panel = NULL;
    for (auto &btn : ui_BeanScreen_beanBtns)
        btn = NULL;
}

// ---------------------------------------------------------------------------
// Screen 2: grind-size prompt
// ---------------------------------------------------------------------------
lv_obj_t *ui_BeanGrindScreen = NULL;
lv_obj_t *ui_BeanGrindScreen_dials = NULL;
lv_obj_t *uic_BeanGrindScreen_dials_tempGauge = NULL;
lv_obj_t *uic_BeanGrindScreen_dials_tempText = NULL;
static lv_obj_t *ui_BeanGrindScreen_backBtn = NULL;
static lv_obj_t *ui_BeanGrindScreen_panel = NULL;
static lv_obj_t *ui_BeanGrindScreen_value = NULL;
static lv_obj_t *ui_BeanGrindScreen_minusBtn = NULL;
static lv_obj_t *ui_BeanGrindScreen_plusBtn = NULL;
static lv_obj_t *ui_BeanGrindScreen_confirmBtn = NULL;
static lv_obj_t *ui_BeanGrindScreen_errorLabel = NULL;

static void ui_event_BeanGrindScreen(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_GESTURE && lv_indev_get_gesture_dir(lv_indev_get_act()) == LV_DIR_TOP) {
        lv_indev_wait_release(lv_indev_get_act());
        onMenuClick(e);
    }
    if (code == LV_EVENT_SCREEN_LOADED) {
        lv_obj_set_ext_click_area(ui_BeanGrindScreen_minusBtn, 40);
        lv_obj_set_ext_click_area(ui_BeanGrindScreen_plusBtn, 40);
        lv_obj_set_ext_click_area(ui_BeanGrindScreen_confirmBtn, 30);
        lv_obj_set_ext_click_area(ui_BeanGrindScreen_backBtn, 20);
    }
}

static void ui_event_BeanGrindScreen_backBtn(lv_event_t *e) {
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        controller.getUI()->changeScreen(&ui_BeanScreen, &ui_BeanScreen_screen_init);
    }
}

static void ui_event_BeanGrindScreen_step(lv_event_t *e) {
    if (lv_event_get_code(e) != LV_EVENT_CLICKED) {
        return;
    }
    const float dir = lv_event_get_user_data(e) ? 1.0f : -1.0f;
    grindValue += dir * GRIND_STEP;
    if (grindValue < GRIND_MIN)
        grindValue = GRIND_MIN;
    if (grindValue > GRIND_MAX)
        grindValue = GRIND_MAX;
    formatGrind(ui_BeanGrindScreen_value);
    lv_obj_add_flag(ui_BeanGrindScreen_errorLabel, LV_OBJ_FLAG_HIDDEN);
}

static void ui_event_BeanGrindScreen_confirm(lv_event_t *e) {
    if (lv_event_get_code(e) != LV_EVENT_CLICKED) {
        return;
    }
    if (selectedBeanIdx < 0 || selectedBeanIdx >= static_cast<int>(beanList.size())) {
        return;
    }
    String error;
    if (!controller.startBeanShot(beanList[selectedBeanIdx].id, grindValue, error)) {
        lv_label_set_text(ui_BeanGrindScreen_errorLabel, error.c_str());
        lv_obj_clear_flag(ui_BeanGrindScreen_errorLabel, LV_OBJ_FLAG_HIDDEN);
    }
    // On success Controller::activate() fires controller:brew:start, which
    // DefaultUI already turns into a switch to the status screen.
}

void ui_BeanGrindScreen_screen_init(void) {
    ui_BeanGrindScreen = createScreenSkeleton(&ui_BeanGrindScreen_dials, &ui_BeanGrindScreen_panel);
    lv_obj_add_event_cb(ui_BeanGrindScreen, scr_unloaded_delete_cb, LV_EVENT_SCREEN_UNLOADED,
                        (void *)ui_BeanGrindScreen_screen_destroy);

    ui_BeanGrindScreen_backBtn = lv_imgbtn_create(ui_BeanGrindScreen);
    styleThemedImgBtn(ui_BeanGrindScreen_backBtn, &ui_img_295763949, 0, 210);

    const bool haveBean = selectedBeanIdx >= 0 && selectedBeanIdx < static_cast<int>(beanList.size());

    lv_obj_t *title = lv_label_create(ui_BeanGrindScreen_panel);
    styleThemedLabel(title, &lv_font_montserrat_24);
    lv_obj_set_align(title, LV_ALIGN_CENTER);
    lv_obj_set_y(title, -140);
    lv_obj_set_width(title, 260);
    lv_obj_set_height(title, 30);
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
    lv_label_set_text(title, haveBean ? beanList[selectedBeanIdx].name.c_str() : "Bean");

    lv_obj_t *subtitle = lv_label_create(ui_BeanGrindScreen_panel);
    styleThemedLabel(subtitle, &lv_font_montserrat_18);
    lv_obj_set_align(subtitle, LV_ALIGN_CENTER);
    lv_obj_set_y(subtitle, -95);
    lv_label_set_text(subtitle, "Grind size");

    ui_BeanGrindScreen_value = lv_label_create(ui_BeanGrindScreen_panel);
    styleThemedLabel(ui_BeanGrindScreen_value, &lv_font_montserrat_34);
    lv_obj_set_width(ui_BeanGrindScreen_value, 140);
    lv_obj_set_align(ui_BeanGrindScreen_value, LV_ALIGN_CENTER);
    lv_obj_set_y(ui_BeanGrindScreen_value, 0);
    formatGrind(ui_BeanGrindScreen_value);

    ui_BeanGrindScreen_minusBtn = lv_imgbtn_create(ui_BeanGrindScreen_panel);
    styleThemedImgBtn(ui_BeanGrindScreen_minusBtn, &ui_img_834125362, -110, 0);
    ui_BeanGrindScreen_plusBtn = lv_imgbtn_create(ui_BeanGrindScreen_panel);
    styleThemedImgBtn(ui_BeanGrindScreen_plusBtn, &ui_img_390988422, 110, 0);

    ui_BeanGrindScreen_errorLabel = lv_label_create(ui_BeanGrindScreen_panel);
    styleThemedLabel(ui_BeanGrindScreen_errorLabel, &lv_font_montserrat_14);
    lv_obj_set_width(ui_BeanGrindScreen_errorLabel, 280);
    lv_label_set_long_mode(ui_BeanGrindScreen_errorLabel, LV_LABEL_LONG_WRAP);
    lv_obj_set_align(ui_BeanGrindScreen_errorLabel, LV_ALIGN_CENTER);
    lv_obj_set_y(ui_BeanGrindScreen_errorLabel, 60);
    lv_label_set_text(ui_BeanGrindScreen_errorLabel, "");
    lv_obj_add_flag(ui_BeanGrindScreen_errorLabel, LV_OBJ_FLAG_HIDDEN);

    ui_BeanGrindScreen_confirmBtn = lv_imgbtn_create(ui_BeanGrindScreen_panel);
    styleThemedImgBtn(ui_BeanGrindScreen_confirmBtn, &ui_img_631115820, 0, 120);

    lv_obj_add_event_cb(ui_BeanGrindScreen_backBtn, ui_event_BeanGrindScreen_backBtn, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_BeanGrindScreen_minusBtn, ui_event_BeanGrindScreen_step, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_BeanGrindScreen_plusBtn, ui_event_BeanGrindScreen_step, LV_EVENT_ALL, reinterpret_cast<void *>(1));
    lv_obj_add_event_cb(ui_BeanGrindScreen_confirmBtn, ui_event_BeanGrindScreen_confirm, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(ui_BeanGrindScreen, ui_event_BeanGrindScreen, LV_EVENT_ALL, NULL);
    uic_BeanGrindScreen_dials_tempGauge = ui_comp_get_child(ui_BeanGrindScreen_dials, UI_COMP_DIALS_TEMPGAUGE);
    uic_BeanGrindScreen_dials_tempText = ui_comp_get_child(ui_BeanGrindScreen_dials, UI_COMP_DIALS_TEMPTEXT);
}

void ui_BeanGrindScreen_screen_destroy(void) {
    if (ui_BeanGrindScreen)
        lv_obj_del(ui_BeanGrindScreen);
    ui_BeanGrindScreen = NULL;
    ui_BeanGrindScreen_dials = NULL;
    uic_BeanGrindScreen_dials_tempGauge = NULL;
    uic_BeanGrindScreen_dials_tempText = NULL;
    ui_BeanGrindScreen_backBtn = NULL;
    ui_BeanGrindScreen_panel = NULL;
    ui_BeanGrindScreen_value = NULL;
    ui_BeanGrindScreen_minusBtn = NULL;
    ui_BeanGrindScreen_plusBtn = NULL;
    ui_BeanGrindScreen_confirmBtn = NULL;
    ui_BeanGrindScreen_errorLabel = NULL;
}
