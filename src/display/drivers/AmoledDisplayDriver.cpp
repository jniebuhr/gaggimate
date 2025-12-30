#include "AmoledDisplayDriver.h"
#include "AmoledDisplay/pin_config.h"
#include <Wire.h>
#include <display/drivers/common/LV_Helper.h>

AmoledDisplayDriver *AmoledDisplayDriver::instance = nullptr;

static bool detectI2CDevice(uint8_t address, const char *deviceName = nullptr) {
    for (uint8_t retry = 0; retry < 5; retry++) {
        Wire.beginTransmission(address);
        if (Wire.endTransmission() == 0) {
            if (deviceName) {
                ESP_LOGI("AmoledDisplayDriver", "Found %s at 0x%02X\n", deviceName, address);
            } else {
                ESP_LOGI("AmoledDisplayDriver", "Found device at 0x%02X\n", address);
            }
            return true;
        }
        delay(100);
    }
    return false;
}

bool AmoledDisplayDriver::isCompatible() {
    ESP_LOGI("AmoledDisplayDriver", "Testing LilyGo T-Display...");
    if (testHw(LILYGO_T_DISPLAY_S3_DS_HW_CONFIG)) {
        hwConfig = LILYGO_T_DISPLAY_S3_DS_HW_CONFIG;
        return true;
    }
    ESP_LOGI("AmoledDisplayDriver", "Testing Waveshare 1.75\" AMOLED Display...");
    if (testHw(WAVESHARE_S3_AMOLED_HW_CONFIG)) {
        hwConfig = WAVESHARE_S3_AMOLED_HW_CONFIG;
        return true;
    }
    ESP_LOGI("AmoledDisplayDriver", "Testing Waveshare 1.32\" AMOLED Display...");
    if (testHw_Waveshare132(WAVESHARE_132_HW_CONFIG)) {
        hwConfig = WAVESHARE_132_HW_CONFIG;
        return true;
    }
    return false;
}

void AmoledDisplayDriver::init() {
    panel = new Amoled_DisplayPanel(hwConfig);
    ESP_LOGI("AmoledDisplayDriver", "Initializing AMOLED Display (width=%d, height=%d)...", 
             hwConfig.lcd_width, hwConfig.lcd_height);

    if (!panel->begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            ESP_LOGE("AmoledDisplayDriver", "Error, failed to initialize display!");
            delay(1000);
        }
        ESP.restart();
    }

    beginLvglHelper(*panel);

    panel->setBrightness(16);
    ESP_LOGI("AmoledDisplayDriver", "Display initialized successfully!");
}

bool AmoledDisplayDriver::supportsSDCard() { 
    // Waveshare 1.32" has no SD card slot
    return hwConfig.sd_cs >= 0; 
}

bool AmoledDisplayDriver::installSDCard() { 
    if (!supportsSDCard()) {
        return false;
    }
    return panel->installSD(); 
}

bool AmoledDisplayDriver::testHw(AmoledHwConfig hwConfig) {
    // No Wire on these pins, definitely wrong board
    if (!Wire.begin(hwConfig.i2c_sda, hwConfig.i2c_scl))
        return false;

    // Required: PCF8563 (RTC) and SY6970 (Battery management)
    // Touch sensor: Either CST92XX (1.75 inch) or FT3168 (1.43 inch)
    bool pcf8563Found = detectI2CDevice(PCF8563_DEVICE_ADDRESS, "PCF8563 RTC");

    bool touchFound = detectI2CDevice(CST92XX_DEVICE_ADDRESS, "CST92XX Touch Sensor") ||
                      detectI2CDevice(FT3168_DEVICE_ADDRESS, "FT3168 Touch Sensor");

    Wire.end();
    return pcf8563Found && touchFound;
}

bool AmoledDisplayDriver::testHw_Waveshare132(AmoledHwConfig hwConfig) {
    // Initialize I2C with power enabled
    pinMode(hwConfig.lcd_en, OUTPUT);
    digitalWrite(hwConfig.lcd_en, HIGH);  // Enable display power
    delay(100);
    
    // Reset touch controller FIRST (important!)
    if (hwConfig.tp_rst >= 0) {
        pinMode(hwConfig.tp_rst, OUTPUT);
        digitalWrite(hwConfig.tp_rst, LOW);
        delay(10);
        digitalWrite(hwConfig.tp_rst, HIGH);
        delay(50);
    }
    
    if (!Wire.begin(hwConfig.i2c_sda, hwConfig.i2c_scl)) {
        ESP_LOGE("AmoledDisplayDriver", "Failed to initialize I2C on pins SDA=%d, SCL=%d", 
                 hwConfig.i2c_sda, hwConfig.i2c_scl);
        return false;
    }

    // Waveshare 1.32" has CST820 touch controller at 0x15
    // No RTC or battery management on this board
    bool cst820Found = detectI2CDevice(CST820_DEVICE_ADDRESS, "CST820 Touch");

    Wire.end();
    
    if (cst820Found) {
        ESP_LOGI("AmoledDisplayDriver", "Waveshare 1.32\" AMOLED detected!");
        return true;
    }
    
    ESP_LOGW("AmoledDisplayDriver", "CST820 touch controller not found for Waveshare 1.32\"");
    return false;
}
