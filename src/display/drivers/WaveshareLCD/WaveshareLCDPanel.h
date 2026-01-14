#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <display/drivers/common/Display.h>
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_io.h"

// Forward declarations
class TouchDrvInterface;

enum WaveshareLCDPanelType {
    WS_LCD_UNKNOWN,
    WS_LCD_1_85_INCHES,
};

enum WaveshareLCDTouchType {
    WS_LCD_TOUCH_UNKNOWN,
    WS_LCD_TOUCH_CST816,
};

class WaveshareLCDPanel : public Display {
  public:
    WaveshareLCDPanel();
    ~WaveshareLCDPanel();

    bool begin();
    void setBrightness(int brightness);
    String getModel();
    void sleep();
    void wakeup();

    // Display interface
    uint16_t width() override;
    uint16_t height() override;
    uint8_t getPoint(int16_t *x, int16_t *y, uint8_t get_point) override;
    void pushColors(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t *data) override;
    bool supportsDirectMode() override { return false; }

    // SD Card
    bool installSD();
    void uninstallSD();

    WaveshareLCDPanelType getPanelType() { return _panelType; }
    WaveshareLCDTouchType getTouchType() { return _touchType; }

  private:
    bool initI2C();
    bool initGPIOExpander();
    void resetLCD();
    void resetTouch();
    bool initDisplay();
    bool initTouch();

    int _brightness;
    WaveshareLCDPanelType _panelType;
    WaveshareLCDTouchType _touchType;

    // Legacy pointers (kept for compatibility, not used with ST77916)
    void *_bus;
    void *_gfx;
    
    // ESP-IDF LCD handles
    esp_lcd_panel_handle_t _panel_handle;
    esp_lcd_panel_io_handle_t _io_handle;
    
    TouchDrvInterface *_touchDrv;

    bool _initialized;
    bool _sdCardInstalled;
};
