#include "main.h"
#include "ControllerConfig.h"
#include "GaggiMateController.h"

GaggiMateController controller(GM_CONTROLLER_REV_1x);

void setup() {
    Serial.begin(115200);
    controller.setup();
}

void loop() {
    controller.loop();
}

