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
#include <driver/spi_master.h>

enum WavesharePanelType {
    WS_UNKNOWN,
    WS_2_1_INCHES,
    WS_2_8_INCHES,
};

enum WS_RGBPanel_TouchType {
    WS_T_RGB_TOUCH_UNKNOWN,
    WS_T_RGB_TOUCH_FT3267,
    WS_T_RGB_TOUCH_CST820,
    WS_T_RGB_TOUCH_GT911,
};

enum WS_RGBPanel_Color_Order {
    WS_T_RGB_ORDER_RGB,
    WS_T_RGB_ORDER_BGR,
};

enum WS_RGBPanel_Wakeup_Method {
    WS_T_RGB_WAKEUP_FORM_TOUCH,
    WS_T_RGB_WAKEUP_FORM_BUTTON,
    WS_T_RGB_WAKEUP_FORM_TIMER,
};

class WavesharePanel : public Display {
  public:
    WavesharePanel();

    ~WavesharePanel() override;

    bool begin(WS_RGBPanel_Color_Order order = WS_T_RGB_ORDER_RGB);

    bool installSD();

    void uninstallSD();

    void setBrightness(uint8_t level);

    uint8_t getBrightness() const;

    WavesharePanelType getModel();

    const char *getTouchModelName() const;

    void enableTouchWakeup();

    void enableButtonWakeup();

    void enableTimerWakeup(uint64_t time_in_us);

    void sleep();

    void wakeup();

    uint16_t width() override;

    uint16_t height() override;

    uint8_t getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point = 1) override;

    bool isPressed() const;

    uint16_t getBattVoltage();

    void pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data) override;

    bool supportsDirectMode() { return false; }

  private:
    void writeData(uint8_t data);

    void writeCommand(uint8_t cmd);

    void initBUS();

    bool initTouch();

    uint8_t _brightness;

    esp_lcd_panel_handle_t _panelDrv;
    spi_device_handle_t SPI_handle = nullptr;

    TouchDrvInterface *_touchDrv;

    WS_RGBPanel_Color_Order _order;

    bool _has_init;

    WS_RGBPanel_Wakeup_Method _wakeupMethod;

    uint64_t _sleepTimeUs;

    WS_RGBPanel_TouchType _touchType;
};
