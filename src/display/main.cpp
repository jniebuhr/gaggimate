#include "main.h"

#ifndef GAGGIMATE_HEADLESS
#include <lvgl.h>
#endif

Controller controller;

void setup() {
    Serial.begin(115200);
    
    // Wait for serial and show boot progress
    for (int i = 0; i < 20; i++) {
        Serial.print(".");
        delay(100);
    }
    Serial.println();
    Serial.println("GaggiMate starting...");
    
    controller.setup();
}

void loop() {
    controller.loop();
    delay(2);
}
