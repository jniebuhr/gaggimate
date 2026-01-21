/**
 * @file      Amoled_DisplayPanel.h
 * @author    Borys Tymchenko
 * @license   MIT
 * @copyright
 * @date      2025-05-19
 *
 */

#pragma once

#include <Arduino.h>
#include <memory>

#ifndef BOARD_HAS_PSRAM
#error "Please turn on PSRAM to OPI !"
#endif

#include "CO5300.h"
#include "pin_config.h"
#include <SD_MMC.h>
#include <TouchDrvInterface.hpp>
#include <display/drivers/common/Display.h>
#include <display/drivers/common/ext.h>

enum Amoled_Display_Panel_Type {
    DISPLAY_UNKNOWN,
    DISPLAY_1_43_INCHES,
    DISPLAY_1_75_INCHES,
};

enum Amoled_Display_Panel_TouchType {
    TOUCH_UNKNOWN,
    TOUCH_FT3168,
    TOUCH_CST92XX,
};

enum Amoled_Display_Panel_Color_Order {
    ORDER_RGB = CO5300_MADCTL_RGB,
    ORDER_BGR = CO5300_MADCTL_BGR,
};

enum Amoled_Display_Panel_Wakeup_Method {
    WAKEUP_FROM_NONE,
    WAKEUP_FROM_TOUCH,
    WAKEUP_FROM_BUTTON,
    WAKEUP_FROM_TIMER,
};

class Amoled_DisplayPanel : public Display {

  public:
    Amoled_DisplayPanel(AmoledHwConfig hwConfig);

    ~Amoled_DisplayPanel();

    bool begin(Amoled_Display_Panel_Color_Order order = ORDER_RGB);

    bool installSD();

    void uninstallSD();

    void setBrightness(uint8_t level);

    uint8_t getBrightness();

    Amoled_Display_Panel_Type getModel();

    const char *getTouchModelName();

    void enableTouchWakeup();
    void enableButtonWakeup();
    void enableTimerWakeup(uint64_t time_in_us);

    void sleep();

    void wakeup();

    uint16_t width() override { return hwConfig.lcd_width; };

    uint16_t height() override { return hwConfig.lcd_height; };

    uint8_t getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point = 1);

    bool isPressed();

    uint16_t getBattVoltage(void);

    void pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data);

    bool supportsDirectMode() { return true; }

    void setRotation(uint8_t rotation);

  private:
    bool initTouch();
    bool initDisplay(Amoled_Display_Panel_Color_Order colorOrder);

  private:
    AmoledHwConfig hwConfig;
    TouchDrvInterface *_touchDrv = nullptr;
    Arduino_DataBus *displayBus = nullptr;
    CO5300 *display = nullptr;

    uint8_t currentBrightness = 0;

    Amoled_Display_Panel_Type panelType = DISPLAY_UNKNOWN;
    Amoled_Display_Panel_TouchType touchType = TOUCH_UNKNOWN;

    Amoled_Display_Panel_Wakeup_Method _wakeupMethod;
    uint64_t _sleepTimeUs;
};
