/**
 * @file      LilyGo_RGBPanel.h
 * @author    Lewis He (lewishe@outlook.com)
 * @license   MIT
 * @copyright Copyright (c) 2024  Shenzhen Xin Yuan Electronic Technology Co., Ltd
 * @date      2024-01-22
 *
 */

#pragma once

#include <Arduino.h>

#ifndef BOARD_HAS_PSRAM
#error "Please turn on PSRAM to OPI !"
#endif

#include <SD_MMC.h>
#include <esp_lcd_panel_io.h>
#include <esp_lcd_panel_ops.h>
#include <esp_lcd_panel_rgb.h>
#include <esp_lcd_panel_vendor.h>

#include <display/drivers/common/Display.h>
#include <display/drivers/common/ext.h>

enum LilyGo_RGBPanel_Type {
    LILYGO_T_RGB_UNKNOWN,
    LILYGO_T_RGB_2_1_INCHES,
    LILYGO_T_RGB_2_8_INCHES,
};

enum LilyGo_RGBPanel_TouchType {
    LILYGO_T_RGB_TOUCH_UNKNOWN,
    LILYGO_T_RGB_TOUCH_FT3267,
    LILYGO_T_RGB_TOUCH_CST820,
    LILYGO_T_RGB_TOUCH_GT911,
};

enum LilyGo_RGBPanel_Color_Order {
    LILYGO_T_RGB_ORDER_RGB,
    LILYGO_T_RGB_ORDER_BGR,
};

enum LilyGo_RGBPanel_Wakeup_Method {
    LILYGO_T_RGB_WAKEUP_FORM_TOUCH,
    LILYGO_T_RGB_WAKEUP_FORM_BUTTON,
    LILYGO_T_RGB_WAKEUP_FORM_TIMER,
};

class LilyGo_RGBPanel : public Display {

  public:
    LilyGo_RGBPanel();

    ~LilyGo_RGBPanel();

    bool begin(LilyGo_RGBPanel_Color_Order order = LILYGO_T_RGB_ORDER_RGB);

    bool installSD();

    void uninstallSD();

    void setBrightness(uint8_t level);

    uint8_t getBrightness() const;

    LilyGo_RGBPanel_Type getModel();

    const char *getTouchModelName();

    void enableTouchWakeup();
    void enableButtonWakeup();
    void enableTimerWakeup(uint64_t time_in_us);

    void sleep();

    void wakeup();

    uint16_t width();

    uint16_t height();

    uint8_t getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point = 1);

    bool isPressed();

    uint16_t getBattVoltage(void);

    void pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data);

  private:
    void writeData(const uint8_t *data, int len);

    void writeCommand(const uint8_t cmd);

    void initBUS();

    bool initTouch();

    uint8_t _brightness;

    esp_lcd_panel_handle_t _panelDrv;

    TouchDrvInterface *_touchDrv;

    LilyGo_RGBPanel_Color_Order _order;

    bool _has_init;

    LilyGo_RGBPanel_Wakeup_Method _wakeupMethod;

    uint64_t _sleepTimeUs;

    LilyGo_RGBPanel_TouchType _touchType;

    ExtensionIOXL9555::ExtensionGPIO cs = ExtensionIOXL9555::IO3;
    ExtensionIOXL9555::ExtensionGPIO mosi = ExtensionIOXL9555::IO4;
    ExtensionIOXL9555::ExtensionGPIO sclk = ExtensionIOXL9555::IO5;
    ExtensionIOXL9555::ExtensionGPIO reset = ExtensionIOXL9555::IO6;
    ExtensionIOXL9555::ExtensionGPIO power_enable = ExtensionIOXL9555::IO2;
    ExtensionIOXL9555::ExtensionGPIO sdmmc_cs = ExtensionIOXL9555::IO7;
    ExtensionIOXL9555::ExtensionGPIO tp_reset = ExtensionIOXL9555::IO1;
};
