/**
 * @file      LV_Helper.cpp
 * @author    Lewis He (lewishe@outlook.com)
 * @license   MIT
 * @copyright Copyright (c) 2024  Shenzhen Xin Yuan Electronic Technology Co.,
 * Ltd
 * @date      2024-01-22
 *
 */
#include "LV_Helper.h"

#if LV_VERSION_CHECK(9, 0, 0)
#error "Currently not supported 9.x"
#endif

static lv_disp_draw_buf_t draw_buf;
static lv_disp_drv_t disp_drv;
static lv_indev_drv_t indev_drv;
static lv_color_t *buf = NULL;
static lv_color_t *buf1 = NULL;

static lv_color_filter_dsc_t s_map_filter;
static lv_style_t s_map_style;
static lv_theme_t s_theme;
static lv_theme_t *s_parent_theme;

static lv_color_t map_color_cb(const lv_color_filter_dsc_t *dsc, lv_color_t c, lv_opa_t opa) {
    LV_UNUSED(dsc);
    LV_UNUSED(opa);
    if (c.full == lv_color_hex(0x131313).full) {
        return lv_color_black();
    }
    return c;
}

static void theme_apply_cb(lv_theme_t *th, lv_obj_t *obj) {
    LV_UNUSED(th);
    if (s_parent_theme && s_parent_theme->apply_cb) {
        s_parent_theme->apply_cb(s_parent_theme, obj);
    }

    if (lv_obj_get_parent(obj) == NULL) {
        lv_obj_add_style(obj, &s_map_style, 0);
    }
}

void enable_amoled_black_theme_override(lv_disp_t *disp) {
    lv_color_filter_dsc_init(&s_map_filter, map_color_cb);

    lv_style_init(&s_map_style);
    lv_style_set_color_filter_dsc(&s_map_style, &s_map_filter);
    lv_style_set_color_filter_opa(&s_map_style, LV_OPA_COVER);

    // we need to copy because of editing parent theme directly causes crash
    s_parent_theme = lv_disp_get_theme(disp);
    s_theme = *s_parent_theme;
    s_theme.apply_cb = theme_apply_cb;

    lv_disp_set_theme(disp, &s_theme);

    // apply immediately to the current active screen
    lv_obj_add_style(lv_scr_act(), &s_map_style, 0);
}

/* Display flushing */
static void disp_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p) {
    static_cast<Display *>(disp_drv->user_data)->pushColors(area->x1, area->y1, area->x2 + 1, area->y2 + 1, (uint16_t *)color_p);
    lv_disp_flush_ready(disp_drv);
}

/*Read the touchpad*/
static void touchpad_read(lv_indev_drv_t *indev_driver, lv_indev_data_t *data) {
    static int16_t x, y;
    uint8_t touched = static_cast<Display *>(indev_driver->user_data)->getPoint(&x, &y, 1);
    if (touched) {
        data->point.x = x;
        data->point.y = y;
        data->state = LV_INDEV_STATE_PR;
        return;
    }
    data->state = LV_INDEV_STATE_REL;
}

#if LV_USE_LOG
void lv_log_print_g_cb(const char *buf) {
    Serial.println(buf);
    Serial.flush();
}
#endif

String lvgl_helper_get_fs_filename(String filename) {
    static String path;
    path = String("A") + ":" + (filename);
    return path;
}

const char *lvgl_helper_get_fs_filename(const char *filename) {
    static String path;
    path = String("A") + ":" + String(filename);
    return path.c_str();
}

void beginLvglHelper(Display &board, bool debug) {

    lv_init();

#if LV_USE_LOG
    if (debug) {
        lv_log_register_print_cb(lv_log_print_g_cb);
    }
#endif

    size_t lv_buffer_size = board.width() * board.height() * sizeof(lv_color_t);
    buf = (lv_color_t *)ps_malloc(lv_buffer_size);
    assert(buf);

    if (!board.supportsDirectMode()) {
        buf1 = (lv_color_t *)ps_malloc(lv_buffer_size);
        assert(buf1);
    }

    lv_disp_draw_buf_init(&draw_buf, buf, buf1, board.width() * board.height());

    /*Initialize the display*/
    lv_disp_drv_init(&disp_drv);
    /* display resolution */
    disp_drv.hor_res = board.width();
    disp_drv.ver_res = board.height();
    disp_drv.flush_cb = disp_flush;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.full_refresh = 0;
    disp_drv.direct_mode = board.supportsDirectMode();
    disp_drv.user_data = &board;
    lv_disp_drv_register(&disp_drv);

    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = touchpad_read;
    indev_drv.user_data = &board;
    lv_indev_drv_register(&indev_drv);
}
