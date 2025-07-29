#include "main.h"

#ifndef GAGGIMATE_HEADLESS
#include <lvgl.h>
#endif

Controller controller;

void setup() {
    Serial.begin(115200);
    controller.setup();
}

void loop() {
    controller.loop();
    delay(2);
}
