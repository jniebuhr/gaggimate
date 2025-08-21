#include "LilyGoTDisplayDriver.h"
#include "LilyGo-T-Display-S3-DS/pin_config.h"
#include <Wire.h>
#include <display/drivers/common/LV_Helper.h>

LilyGoTDisplayDriver *LilyGoTDisplayDriver::instance = nullptr;

bool LilyGoTDisplayDriver::isCompatible() {
    // No Wire on these pins, definitely wrong board
    if (!Wire.begin(IIC_SDA, IIC_SCL))
        return false;

    // Check for devices on the I2C bus, if found all, it's a compatible board
    const uint8_t addresses[] = {FT3168_DEVICE_ADDRESS, PCF8563_DEVICE_ADDRESS, SY6970_DEVICE_ADDRESS};
    bool success = true;

    for (auto addr : addresses) {
        bool found = false;
        for (uint8_t retry = 0; retry < 5; retry++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf("Found device at 0x%02X\n", addr);
                found = true;
                break;
            }
            delay(100);
        }
        if (!found) {
            success = false;
            break;
        }
    }

    Wire.end();
    return success;
}

void LilyGoTDisplayDriver::init() {
    printf("LilyGoTDisplayDriver initialzing\n");

    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            Serial.println("Error, failed to initialize T-Display");
            delay(1000);
        }
        ESP.restart();
    }

    beginLvglHelper(panel);

    panel.setBrightness(16);
}
