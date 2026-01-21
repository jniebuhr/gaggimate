#ifndef CONTROLLERCONFIG_H
#define CONTROLLERCONFIG_H
#include <string>

struct Capabilities {
    bool dimming;
    bool pressure;
    bool ssrPump;
    bool ledControls;
    bool tof;
};

struct ControllerConfig {
    std::string name;

    // The autodetect value that is measured through a PCB voltage divider.
    // The detected value in milli volts is divided by 100 and rounded.
    uint16_t autodetectValue;

    uint8_t heaterPin;
    uint8_t pumpPin;
    uint8_t pumpSensePin = 0;
    uint8_t pumpOn;
    uint8_t valvePin;
    uint8_t valveOn;
    uint8_t altPin;
    uint8_t altOn;

    uint8_t pressureScl = 0;
    uint8_t pressureSda = 0;

    uint8_t maxSckPin;
    uint8_t maxCsPin;
    uint8_t maxMisoPin;

    uint8_t brewButtonPin;
    uint8_t steamButtonPin;

    uint8_t scaleSclPin;
    uint8_t scaleSdaPin;
    uint8_t scaleSda1Pin;

    uint8_t sunriseSclPin;
    uint8_t sunriseSdaPin;

    uint8_t ext1Pin;
    uint8_t ext2Pin;
    uint8_t ext3Pin;
    uint8_t ext4Pin;
    uint8_t ext5Pin;

    Capabilities capabilites;
};

const ControllerConfig GM_STANDARD_REV_1X = {.name = "GaggiMate Standard Rev 1.x",
                                             .autodetectValue = 0, // Voltage divider was missing in Rev 1.0 so it's 0
                                             .heaterPin = 14,
                                             .pumpPin = 9,
                                             .pumpOn = 1,
                                             .valvePin = 10,
                                             .valveOn = 1,
                                             .altPin = 11,
                                             .altOn = 1,
                                             .maxSckPin = 6,
                                             .maxCsPin = 7,
                                             .maxMisoPin = 4,
                                             .brewButtonPin = 38,
                                             .steamButtonPin = 48,
                                             .scaleSclPin = 17,
                                             .scaleSdaPin = 18,
                                             .scaleSda1Pin = 39,
                                             .ext1Pin = 1,
                                             .ext2Pin = 2,
                                             .ext3Pin = 8,
                                             .ext4Pin = 12,
                                             .ext5Pin = 13,
                                             .capabilites = {
                                                 .dimming = false,
                                                 .pressure = false,
                                                 .ssrPump = false,
                                                 .ledControls = false,
                                                 .tof = false,
                                             }};

const ControllerConfig GM_STANDARD_REV_2X = {.name = "GaggiMate Standard Rev 2.x",
                                             .autodetectValue = 1, // Voltage divider was missing in Rev 1.0 so it's 0
                                             .heaterPin = 14,
                                             .pumpPin = 9,
                                             .pumpOn = 1,
                                             .valvePin = 10,
                                             .valveOn = 1,
                                             .altPin = 47,
                                             .altOn = 1,
                                             .maxSckPin = 6,
                                             .maxCsPin = 7,
                                             .maxMisoPin = 4,
                                             .brewButtonPin = 38,
                                             .steamButtonPin = 48,
                                             .scaleSclPin = 17,
                                             .scaleSdaPin = 18,
                                             .scaleSda1Pin = 39,
                                             .sunriseSclPin = 44,
                                             .sunriseSdaPin = 43,
                                             .ext1Pin = 1,
                                             .ext2Pin = 2,
                                             .ext3Pin = 8,
                                             .ext4Pin = 12,
                                             .ext5Pin = 13,
                                             .capabilites = {
                                                 .dimming = false,
                                                 .pressure = false,
                                                 .ssrPump = true,
                                                 .ledControls = false,
                                                 .tof = false,
                                             }};

const ControllerConfig GM_PRO_REV_1x = {.name = "GaggiMate Pro Rev 1.x",
                                        .autodetectValue = 2, // Voltage divider was missing in Rev 1.0 so it's 0
                                        .heaterPin = 14,
                                        .pumpPin = 9,
                                        .pumpSensePin = 21,
                                        .pumpOn = 1,
                                        .valvePin = 10,
                                        .valveOn = 1,
                                        .altPin = 47,
                                        .altOn = 1,
                                        .pressureScl = 41,
                                        .pressureSda = 42,
                                        .maxSckPin = 6,
                                        .maxCsPin = 7,
                                        .maxMisoPin = 4,
                                        .brewButtonPin = 38,
                                        .steamButtonPin = 48,
                                        .scaleSclPin = 17,
                                        .scaleSdaPin = 18,
                                        .scaleSda1Pin = 39,
                                        .sunriseSclPin = 44,
                                        .sunriseSdaPin = 43,
                                        .ext1Pin = 1,
                                        .ext2Pin = 2,
                                        .ext3Pin = 8,
                                        .ext4Pin = 12,
                                        .ext5Pin = 13,
                                        .capabilites = {
                                            .dimming = true,
                                            .pressure = true,
                                            .ssrPump = false,
                                            .ledControls = false,
                                            .tof = false,
                                        }};

const ControllerConfig GM_PRO_LEGO = {.name = "GaggiMate Pro Lego Build",
                                      .autodetectValue = 3,
                                      .heaterPin = 14,
                                      .pumpPin = 9,
                                      .pumpSensePin = 21,
                                      .pumpOn = 1,
                                      .valvePin = 10,
                                      .valveOn = 1,
                                      .altPin = 47,
                                      .altOn = 1,
                                      .pressureScl = 41,
                                      .pressureSda = 42,
                                      .maxSckPin = 6,
                                      .maxCsPin = 7,
                                      .maxMisoPin = 4,
                                      .brewButtonPin = 38,
                                      .steamButtonPin = 48,
                                      .scaleSclPin = 17,
                                      .scaleSdaPin = 18,
                                      .scaleSda1Pin = 39,
                                      .sunriseSclPin = 44,
                                      .sunriseSdaPin = 43,
                                      .ext1Pin = 1,
                                      .ext2Pin = 2,
                                      .ext3Pin = 8,
                                      .ext4Pin = 12,
                                      .ext5Pin = 13,
                                      .capabilites = {
                                          .dimming = true,
                                          .pressure = true,
                                          .ssrPump = false,
                                          .ledControls = false,
                                          .tof = false,
                                      }};

const ControllerConfig GM_PRO_REV_11 = {.name = "GaggiMate Pro Rev 1.1",
                                        .autodetectValue = 4,
                                        .heaterPin = 14,
                                        .pumpPin = 9,
                                        .pumpSensePin = 21,
                                        .pumpOn = 1,
                                        .valvePin = 10,
                                        .valveOn = 1,
                                        .altPin = 47,
                                        .altOn = 1,
                                        .pressureScl = 41,
                                        .pressureSda = 42,
                                        .maxSckPin = 6,
                                        .maxCsPin = 7,
                                        .maxMisoPin = 4,
                                        .brewButtonPin = 38,
                                        .steamButtonPin = 48,
                                        .scaleSclPin = 17,
                                        .scaleSdaPin = 18,
                                        .scaleSda1Pin = 39,
                                        .sunriseSclPin = 44,
                                        .sunriseSdaPin = 43,
                                        .ext1Pin = 1,
                                        .ext2Pin = 2,
                                        .ext3Pin = 8,
                                        .ext4Pin = 12,
                                        .ext5Pin = 13,
                                        .capabilites = {
                                            .dimming = true,
                                            .pressure = true,
                                            .ssrPump = false,
                                            .ledControls = false,
                                            .tof = false,
                                        }};

#endif // CONTROLLERCONFIG_H
