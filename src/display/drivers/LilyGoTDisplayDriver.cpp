#include "LilyGoTDisplayDriver.h"
#include "LilyGo-T-Display-S3-DS/pin_config.h"
#include <Wire.h>
#include <display/drivers/common/LV_Helper.h>

LilyGoTDisplayDriver *LilyGoTDisplayDriver::instance = nullptr;

static bool detectI2CDevice(uint8_t address, const char *deviceName = nullptr) {
    for (uint8_t retry = 0; retry < 5; retry++) {
        Wire.beginTransmission(address);
        if (Wire.endTransmission() == 0) {
            if (deviceName) {
                ESP_LOGI("LilyGoTDisplayDriver", "Found %s at 0x%02X\n", deviceName, address);
            } else {
                ESP_LOGI("LilyGoTDisplayDriver", "Found device at 0x%02X\n", address);
            }
            return true;
        }
        delay(100);
    }
    return false;
}

bool LilyGoTDisplayDriver::isCompatible() {
    // No Wire on these pins, definitely wrong board
    if (!Wire.begin(IIC_SDA, IIC_SCL))
        return false;

    // Required: PCF8563 (RTC) and SY6970 (Battery management)
    // Touch sensor: Either CST92XX (1.75 inch) or FT3168 (1.43 inch)
    bool pcf8563Found = detectI2CDevice(PCF8563_DEVICE_ADDRESS, "PCF8563 RTC");
    bool sy6970Found = detectI2CDevice(SY6970_DEVICE_ADDRESS, "SY6970 Battery Controller");
    
    bool touchFound = detectI2CDevice(CST92XX_DEVICE_ADDRESS, "CST92XX Touch Sensor") ||
                      detectI2CDevice(FT3168_DEVICE_ADDRESS, "FT3168 Touch Sensor");
    
    Wire.end();
    return pcf8563Found && sy6970Found && touchFound;;
}

void LilyGoTDisplayDriver::init() {
    ESP_LOGI("LilyGoTDisplayDriver", "initialzing");

    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            ESP_LOGE("LilyGoTDisplayDriver", "Error, failed to initialize T-Display");
            delay(1000);
        }
        ESP.restart();
    }

    beginLvglHelper(panel);

    panel.setBrightness(16);
}
