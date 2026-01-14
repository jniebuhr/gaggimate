#include "WaveshareLCDDriver.h"
#include <display/drivers/common/LV_Helper.h>
#include <display/drivers/WaveshareLCD/pin_config.h>
#include <Wire.h>

WaveshareLCDDriver *WaveshareLCDDriver::instance = nullptr;

bool WaveshareLCDDriver::detectHardware() {
    // Initialize I2C to detect hardware
    Wire.begin(WS_LCD_185_I2C0_SDA, WS_LCD_185_I2C0_SCL);
    Wire.setClock(400000);
    delay(50);

    // Check for TCA9554PWR GPIO expander at 0x20
    Wire.beginTransmission(WS_LCD_185_TCA9554_ADDR);
    bool tca9554Found = (Wire.endTransmission() == 0);
    
    if (!tca9554Found) {
        ESP_LOGW("WaveshareLCDDriver", "TCA9554PWR not found at 0x%02X", WS_LCD_185_TCA9554_ADDR);
        Wire.end();
        return false;
    }
    ESP_LOGI("WaveshareLCDDriver", "TCA9554PWR found at 0x%02X", WS_LCD_185_TCA9554_ADDR);

    // Note: CST816 may not respond until after LCD reset via GPIO expander
    // We detect based on TCA9554 presence only, touch init happens in begin()
    
    Wire.end();
    
    ESP_LOGI("WaveshareLCDDriver", "Waveshare 1.85 inch LCD detected!");
    return true;
}

bool WaveshareLCDDriver::isCompatible() {
    ESP_LOGI("WaveshareLCDDriver", "Testing Waveshare 1.85\" LCD...");
    return detectHardware();
}

void WaveshareLCDDriver::init() {
    ESP_LOGI("WaveshareLCDDriver", "Initializing Waveshare 1.85\" LCD...");
    
    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            Serial.println(F("Error: Failed to initialize Waveshare 1.85\" LCD"));
            delay(1000);
        }
        ESP.restart();
    }
    
    beginLvglHelper(panel);
    panel.setBrightness(128);
    
    ESP_LOGI("WaveshareLCDDriver", "Initialization complete (360x360)");
}

bool WaveshareLCDDriver::supportsSDCard() {
    return true;
}

bool WaveshareLCDDriver::installSDCard() {
    return panel.installSD();
}