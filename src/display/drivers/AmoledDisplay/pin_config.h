#pragma once

struct AmoledHwConfig {
    int8_t lcd_sdio0;
    int8_t lcd_sdio1;
    int8_t lcd_sdio2;
    int8_t lcd_sdio3;
    int8_t lcd_sclk;
    int8_t lcd_cs;
    int8_t lcd_rst;
    uint16_t lcd_width;
    uint16_t lcd_height;
    int8_t lcd_gram_offset_x;
    int8_t lcd_gram_offset_y;
    int8_t lcd_en;
    int8_t i2c_sda;
    int8_t i2c_scl;
    int8_t tp_int;
    int8_t tp_rst;
    int8_t battery_voltage_adc_data;
    int8_t sd_cs;
    int8_t sd_mosi;
    int8_t sd_miso;
    int8_t sd_sclk;
    int8_t pcf8563_int;
    int8_t rotation_175;
    bool mirror_touch;
};

constexpr AmoledHwConfig LILYGO_T_DISPLAY_S3_DS_HW_CONFIG{
    .lcd_sdio0 = 11,
    .lcd_sdio1 = 13,
    .lcd_sdio2 = 14,
    .lcd_sdio3 = 15,
    .lcd_sclk = 12,
    .lcd_cs = 10,
    .lcd_rst = 17,
    .lcd_width = 466,
    .lcd_height = 466,
    .lcd_gram_offset_x = 8,
    .lcd_gram_offset_y = 8,
    .lcd_en = 16,
    .i2c_sda = 7,
    .i2c_scl = 6,
    .tp_int = 9,
    .tp_rst = -1,
    .battery_voltage_adc_data = 4,
    .sd_cs = 38,
    .sd_mosi = 39,
    .sd_miso = 40,
    .sd_sclk = 41,
    .pcf8563_int = 9,
    .rotation_175 = 2,
    .mirror_touch = false,
};

constexpr AmoledHwConfig WAVESHARE_S3_AMOLED_HW_CONFIG{
    .lcd_sdio0 = 4,
    .lcd_sdio1 = 5,
    .lcd_sdio2 = 6,
    .lcd_sdio3 = 7,
    .lcd_sclk = 38,
    .lcd_cs = 12,
    .lcd_rst = 39,
    .lcd_width = 466,
    .lcd_height = 466,
    .lcd_gram_offset_x = 8,
    .lcd_gram_offset_y = 0,
    .lcd_en = 13,
    .i2c_sda = 15,
    .i2c_scl = 14,
    .tp_int = 11,
    .tp_rst = -1,
    .battery_voltage_adc_data = -1,
    .sd_cs = 41,
    .sd_mosi = 1,
    .sd_miso = 3,
    .sd_sclk = 2,
    .pcf8563_int = -1,
    .rotation_175 = 0,
    .mirror_touch = true,
};

// CORRECT pins for Waveshare ESP32-S3-Touch-AMOLED-1.32
// Replace WAVESHARE_132_HW_CONFIG in your pin_config.h with this:

constexpr AmoledHwConfig WAVESHARE_132_HW_CONFIG{
    // QSPI Display pins - From official Waveshare code
    .lcd_sdio0 = 12,     // LCD_DATA0_PIN
    .lcd_sdio1 = 13,     // LCD_DATA1_PIN
    .lcd_sdio2 = 14,     // LCD_DATA2_PIN
    .lcd_sdio3 = 15,     // LCD_DATA3_PIN
    .lcd_sclk = 11,      // LCD_PCLK_PIN
    .lcd_cs = 10,        // LCD_CS_PIN
    .lcd_rst = 8,        // LCD_RST_PIN
    
    // Display size - Waveshare 1.32" is 466×466 round display
    .lcd_width = 466,
    .lcd_height = 466,
    .lcd_gram_offset_x = 8,
    .lcd_gram_offset_y = 0,
    
    // Power enable
    .lcd_en = 18,        // SYS_POWER_IO_PIN - display power enable
    
    // I2C for touch - CST820 at address 0x15
    .i2c_sda = 47,       // ESP32_SDA_NUM (GPIO_NUM_47)
    .i2c_scl = 48,       // ESP32_SCL_NUM (GPIO_NUM_48)
    .tp_int = 6,         // TOUCH_INT_PIN (GPIO_NUM_6)
    .tp_rst = 7,         // TOUCH_RST_PIN (GPIO_NUM_7)
    
    // No battery ADC or SD card on this board
    .battery_voltage_adc_data = -1,
    .sd_cs = -1,
    .sd_mosi = -1,
    .sd_miso = -1,
    .sd_sclk = -1,
    
    // No RTC on this board
    .pcf8563_int = -1,
    
    // Display rotation - USER_DISP_ROT_NONO (no rotation)
    .rotation_175 = 0,
    .mirror_touch = false
};

// CST820 I2C address - add this at the bottom of pin_config.h if not already there
#define CST820_DEVICE_ADDRESS 0x15

#define CST92XX_DEVICE_ADDRESS 0x5A
#define FT3168_DEVICE_ADDRESS 0x38
#define PCF8563_DEVICE_ADDRESS 0x51
#define SY6970_DEVICE_ADDRESS 0x6A
