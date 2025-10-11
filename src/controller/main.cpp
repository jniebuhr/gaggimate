#include "main.h"
#include "ControllerConfig.h"
#include "GaggiMateController.h"

GaggiMateController controller(BUILD_GIT_VERSION);

void setup() {
    Serial.begin(115200);
    // Wait for Serial to be ready
    delay(2000);
    Serial.println("[MAIN] Serial initialized, starting controller setup");
    Serial.flush();
    controller.setup();
    Serial.println("[MAIN] Controller setup completed");
}

void loop() { controller.loop(); }
