#pragma once

#include <Arduino.h>

#ifndef BOARD_HAS_PSRAM
#error "Please turn on PSRAM to OPI !"
#endif

#include <esp_lcd_panel_io.h>
#include <esp_lcd_panel_ops.h>
#include <esp_lcd_panel_rgb.h>
#include <esp_lcd_panel_vendor.h>

#include <display/drivers/common/Display.h>

class MaTouch21Panel : public Display {

  public:
    MaTouch21Panel();

    ~MaTouch21Panel();

    bool begin(void);

    void setBrightness(uint8_t level);

    uint16_t width();

    uint16_t height();

    uint8_t getPoint(int16_t *x_array, int16_t *y_array, uint8_t get_point = 1);

    void pushColors(uint16_t x, uint16_t y, uint16_t width, uint16_t hight, uint16_t *data);

    bool supportsDirectMode() { return false; }

    bool isCompatible(void);

  private:
    void initBUS();
    bool initTouch();

    int readTouch(int *x, int *y);
    int i2c_read(uint16_t addr, uint8_t reg_addr, uint8_t *reg_data, uint32_t length);
    int i2c_write(uint8_t addr, uint8_t reg_addr, const uint8_t *reg_data, uint32_t length);

    uint8_t _brightness;

    esp_lcd_panel_handle_t _panelDrv;
};
