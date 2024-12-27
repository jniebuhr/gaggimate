#ifndef CONTROLLERCONFIG_H
#define CONTROLLERCONFIG_H
#include <string>

struct ControllerConfig {
    std::string name;

    // The autodetect value that is measured through a PCB voltage divider
    uint16_t autodetectValue;

    uint8_t heaterPin;
    uint8_t pumpPin;
    uint8_t valvePin;
    uint8_t altPin;

    uint8_t maxSckPin;
    uint8_t maxCsPin;
    uint8_t maxMisoPin;

    uint8_t brewButtonPin;
    uint8_t steamButtonPin;

    uint8_t scaleSclPin;
    uint8_t scaleSdaPin;
    uint8_t scaleSda1Pin;

    uint8_t relayOn;
};

const ControllerConfig GM_CONTROLLER_REV_1x = {
    .name = "GaggiMate Controller Rev 1.x",
    .autodetectValue = 0, // Voltage divider was missing in Rev 1.0 so it's 0
    .heaterPin = 14,
    .pumpPin = 9,
    .valvePin = 10,
    .altPin = 11,
    .maxSckPin = 6,
    .maxCsPin = 7,
    .maxMisoPin = 4,
    .brewButtonPin = 38,
    .steamButtonPin = 48,
    .scaleSclPin = 17,
    .scaleSdaPin = 18,
    .scaleSda1Pin = 39,
    .relayOn = 1
};

#endif //CONTROLLERCONFIG_H
