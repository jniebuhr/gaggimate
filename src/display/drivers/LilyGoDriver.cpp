#include "LilyGoDriver.h"
#include <Arduino.h>
#include <display/drivers/common/LV_Helper.h>

LilyGoDriver *LilyGoDriver::instance = nullptr;

bool LilyGoDriver::isCompatible() {
    pinMode(LILYGO_DETECT_PIN, INPUT_PULLDOWN);
    return digitalRead(LILYGO_DETECT_PIN);
}

void LilyGoDriver::init() {
    printf("Initializing LilyGo driver\n");
    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            Serial.println(F("Error, failed to initialize T-RGB"));
            delay(1000);
        }
        ESP.restart();
    }
    beginLvglHelper(panel);
    panel.setBrightness(16);
}
