#include "main.h"

Controller* controller;

void setup() {
    Serial.begin(115200);
    controller = new Controller();
    auto ui = new DefaultUI(controller, controller->getPluginManager());
    controller->setup();
    ui->init();
}

void loop() {
    controller->loop();
    delay(2);
}
