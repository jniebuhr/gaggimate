/**
 * @file      LilyGo_TDisplayPanel.h
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

#include <SD_MMC.h>
#include "CO5300.h"
#include "pin_config.h"
#include <TouchDrvInterface.hpp>
#include <display/drivers/common/Display.h>
#include <display/drivers/common/ext.h>


enum LilyGo_TDisplayPanel_Type {
    LILYGO_T_TDISPLAY_UNKNOWN,
    LILYGO_T_TDISPLAY_1_43_INCHES,
};

enum LilyGo_TDisplayPanel_TouchType {
    LILYGO_T_DISPLAY_TOUCH_UNKNOWN,
    LILYGO_T_DISPLAY_TOUCH_FT3168,
};

enum LilyGo_TDisplayPanel_Color_Order {
    LILYGO_T_DISPLAY_ORDER_RGB = CO5300_MADCTL_RGB,
    LILYGO_T_DISPLAY_ORDER_BGR = CO5300_MADCTL_BGR,
};

enum LilyGo_TDisplayPanel_Wakeup_Method {
    LILYGO_T_DISPLAY_WAKEUP_FROM_NONE,
    LILYGO_T_DISPLAY_WAKEUP_FROM_TOUCH,
    LILYGO_T_DISPLAY_WAKEUP_FROM_BUTTON,
    LILYGO_T_DISPLAY_WAKEUP_FROM_TIMER,
};

class LilyGo_TDisplayPanel : public Display {

  public:
    LilyGo_TDisplayPanel();

    ~LilyGo_TDisplayPanel();

    bool begin(LilyGo_TDisplayPanel_Color_Order order = LILYGO_T_DISPLAY_ORDER_RGB);

    bool installSD();

    void uninstallSD();

    void setBrightness(uint8_t level);

    uint8_t getBrightness();

    LilyGo_TDisplayPanel_Type getModel();

    const char *getTouchModelName();

    void enableTouchWakeup();
    void enableButtonWakeup();
    void enableTimerWakeup(uint64_t time_in_us);

    void sleep();

    void wakeup();

    uint16_t width() override { return LCD_WIDTH; };

    uint16_t height() override { return LCD_HEIGHT; };

    uint8_t getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point = 1);

    bool isPressed();

    uint16_t getBattVoltage(void);

    void pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data);

    bool supportsDirectMode() { return true; }

    void setRotation(uint8_t rotation);

  private:
    bool initTouch();
    bool initDisplay(LilyGo_TDisplayPanel_Color_Order colorOrder);

  private:
    TouchDrvInterface *_touchDrv = nullptr;
    Arduino_DataBus *displayBus = nullptr;
    CO5300 *display = nullptr;

  private:
    uint8_t currentBrightness = 0;
    
    LilyGo_TDisplayPanel_Wakeup_Method _wakeupMethod;
    uint64_t _sleepTimeUs;
};
