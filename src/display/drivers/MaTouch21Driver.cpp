#include "MaTouch21Driver.h"
#include <display/drivers/common/LV_Helper.h>

MaTouch21Driver *MaTouch21Driver::instance = nullptr;

void MaTouch21Driver::init() {
    printf("MaTouch21Driver initialzing\n");
    if (!panel.begin()) {
        for (uint8_t i = 0; i < 20; i++) {
            Serial.println(F("Error, failed to initialize MaTouch21"));
            delay(1000);
        }
        ESP.restart();
    }
    beginLvglHelper(panel);
    panel.setBrightness(16);
}
