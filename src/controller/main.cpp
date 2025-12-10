#include "main.h"
#include "ControllerConfig.h"
#include "GaggiMateController.h"

GaggiMateController controller(BUILD_GIT_VERSION);

void setup() {
    Serial.begin(115200);
    controller.setup();
}

void loop() { controller.loop(); }
