#pragma once

// Waveshare ESP32-S3-Touch-LCD-1.85 Pin Configuration
// Display: 1.85" LCD, 360x360, ST77916 Controller, QSPI Interface
// 
// TWO I2C BUSES:
// - Wire  (I2C0): SDA=11, SCL=10 - for TCA9554PWR GPIO Expander
// - Wire1 (I2C1): SDA=1,  SCL=3  - for Touch Controller CST816

// QSPI LCD Pins
#define WS_LCD_185_CS       21
#define WS_LCD_185_SCK      40
#define WS_LCD_185_SDA0     46
#define WS_LCD_185_SDA1     45
#define WS_LCD_185_SDA2     42
#define WS_LCD_185_SDA3     41

// LCD Control
#define WS_LCD_185_BL       5     // Backlight PWM
#define WS_LCD_185_TE       18    // Tearing Effect

// I2C Bus 0 (Wire) - for GPIO Expander TCA9554PWR
#define WS_LCD_185_I2C0_SDA  11
#define WS_LCD_185_I2C0_SCL  10

// I2C Bus 1 (Wire1) - for Touch Controller CST816
#define WS_LCD_185_I2C1_SDA  1
#define WS_LCD_185_I2C1_SCL  3

// Touch Pins
#define WS_LCD_185_TP_SDA   WS_LCD_185_I2C1_SDA
#define WS_LCD_185_TP_SCL   WS_LCD_185_I2C1_SCL
#define WS_LCD_185_TP_INT   4
#define WS_LCD_185_TP_RST   -1    // Touch reset via GPIO expander EXIO_PIN1

// SD Card Pins
#define WS_LCD_185_SD_SCLK  14
#define WS_LCD_185_SD_MISO  16
#define WS_LCD_185_SD_MOSI  17
#define WS_LCD_185_SD_CS    -1    // SD_CS might be via GPIO expander

// Other Pins
#define WS_LCD_185_RTC_INT  9     // PCF85063 RTC Interrupt
#define WS_LCD_185_BAT_ADC  6     // Battery voltage ADC

// Display Parameters
#define WS_LCD_185_WIDTH    360
#define WS_LCD_185_HEIGHT   360

// PWM Configuration for Backlight
#define WS_LCD_185_PWM_CHANNEL    1
#define WS_LCD_185_PWM_FREQ       20000
#define WS_LCD_185_PWM_RESOLUTION 10      // 10-bit resolution like official code
#define WS_LCD_185_BACKLIGHT_MAX  1024

// I2C Addresses
#define WS_LCD_185_CST816_ADDR    0x15
#define WS_LCD_185_TCA9554_ADDR   0x20

// TCA9554PWR Pin Assignments
#define WS_LCD_185_EXIO_TP_RST    1   // EXIO_PIN1 - Touch Reset
#define WS_LCD_185_EXIO_LCD_RST   2   // EXIO_PIN2 - LCD Reset
