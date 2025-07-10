/*
 * @Description: None
 * @Author: LILYGO_L
 * @Date: 2023-06-05 13:01:59
 * @LastEditTime: 2025-04-26 11:53:07
 */
#pragma once

// DO0143FMST10 1.43 inches (CO5300 FT3168)

#define LCD_SDIO0 11
#define LCD_SDIO1 13
#define LCD_SDIO2 14
#define LCD_SDIO3 15
#define LCD_SCLK 12
#define LCD_CS 10
#define LCD_RST 17
#define LCD_WIDTH 466
#define LCD_HEIGHT 466
#define LCD_GRAM_OFFSET_X 6
#define LCD_GRAM_OFFSET_Y 8

#define LCD_EN 16

// IIC
#define IIC_SDA 7
#define IIC_SCL 6

// TOUCH
#define TP_INT 9
#define TP_RST -1

// Battery Voltage ADC
#define BATTERY_VOLTAGE_ADC_DATA 4

// SD
#define SD_CS 38
#define SD_MOSI 39
#define SD_MISO 40
#define SD_SCLK 41

// PCF8563
#define PCF8563_INT 9

#define FT3168_DEVICE_ADDRESS 0x38
#define PCF8563_DEVICE_ADDRESS 0x51
#define SY6970_DEVICE_ADDRESS 0x6A
