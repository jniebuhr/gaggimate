#include "main.h"
#include "ControllerConfig.h"
#include "GaggiMateController.h"

GaggiMateController controller;

void setup() {
    Serial.begin(115200);
    delay(5000);
    controller.setup();
}

void loop() { controller.loop(); }
