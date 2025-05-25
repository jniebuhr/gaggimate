#include "LilyGoTDisplayDriver.h"
#include "LilyGo-T-Display-S3-DS/pin_config.h"
#include <Wire.h>
#include <display/drivers/common/LV_Helper.h>

LilyGoTDisplayDriver *LilyGoTDisplayDriver::instance = nullptr;

bool LilyGoTDisplayDriver::isCompatible() {
    Wire.begin(IIC_SDA, IIC_SCL);
    Serial.println("I2C Scanner. Scanning...");

    const uint8_t addresses[] = {0x51, 0x6A};
    const uint8_t numAddresses = sizeof(addresses) / sizeof(addresses[0]);
    bool foundAll = false;

    for (uint8_t retry = 0; retry < 5; retry++) {
        uint8_t found = 0;
        for (auto addr : addresses) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf("Found device at 0x%02X\n", addr);
                found++;
            }
        }
        if (found == numAddresses) {
            foundAll = true;
            break;
        }
        delay(100);
    }

    Wire.end();
    return foundAll;
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
