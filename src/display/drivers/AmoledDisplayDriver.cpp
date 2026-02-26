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
    ESP_LOGI("AmoledDisplayDriver", "Testing Waveshare AMOLED Display (1.75 inch)...");
    if (testHw(WAVESHARE_S3_AMOLED_HW_CONFIG)) {
        hwConfig = WAVESHARE_S3_AMOLED_HW_CONFIG;
        return true;
    }
    ESP_LOGI("AmoledDisplayDriver", "Testing Waveshare AMOLED Display (1.43 inch)...");
    if (testHw(WAVESHARE_S3_AMOLED_143_HW_CONFIG)) {
        hwConfig = WAVESHARE_S3_AMOLED_143_HW_CONFIG;
        return true;
    }
    return false;
}

void AmoledDisplayDriver::init() {
    panel = new Amoled_DisplayPanel(hwConfig);
    ESP_LOGI("AmoledDisplayDriver", "Initializing LilyGo T-Display...");

    if (!panel->begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            ESP_LOGE("AmoledDisplayDriver", "Error, failed to initialize T-Display");
            delay(1000);
        }
        ESP.restart();
    }

    beginLvglHelper(*panel);
}

bool AmoledDisplayDriver::supportsSDCard() { return true; }

bool AmoledDisplayDriver::installSDCard() { return panel->installSD(); }

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
