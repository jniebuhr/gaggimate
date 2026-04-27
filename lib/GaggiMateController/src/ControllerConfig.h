#ifndef CONTROLLERCONFIG_H
#define CONTROLLERCONFIG_H
#include <string>

struct Capabilities {
    bool dimming = false;
    bool pressure = false;
    bool ssrPump = false;
    bool ledControls = false;
    bool tof = false;
    bool dualBoiler = false;
};

struct ControllerConfig {
    std::string name;

    // The autodetect value that is measured through a PCB voltage divider.
    // The detected value in milli volts is divided by 100 and rounded.
    uint16_t autodetectValue;

    uint8_t heaterPin;
    uint8_t altPin;
    uint8_t altOn;

    uint8_t pumpPin;
    uint8_t pumpSensePin = 0;
    uint8_t pumpOn;
    uint8_t valvePin;
    uint8_t valveOn;
    // Refill relay for solenoid / pump
    uint8_t refillPin = 0;
    // Auxiliary relay for solenoid / pump
    uint8_t auxPin = 0;

    uint8_t waterSensePin = 0;
    uint8_t tankLevelPin = 0;
    uint8_t ledPin = 0;

    uint8_t pressureScl = 0;
    uint8_t pressureSda = 0;

    uint8_t maxSckPin = 0;
    uint8_t maxCsPin = 0;
    uint8_t maxMisoPin = 0;

    uint8_t brewButtonPin;
    uint8_t steamButtonPin;
    uint8_t waterButtonPin = 0;

    uint8_t scaleClkPin;
    uint8_t scaleDat0Pin;
    uint8_t scaleDat1Pin;

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
                                             .scaleClkPin = 17,
                                             .scaleDat0Pin = 18,
                                             .scaleDat1Pin = 39,
                                             .ext1Pin = 1,
                                             .ext2Pin = 2,
                                             .ext3Pin = 8,
                                             .ext4Pin = 12,
                                             .ext5Pin = 13,
                                             .capabilites = {
                                             }};

const ControllerConfig GM_STANDARD_REV_2X = {.name = "GaggiMate Standard Rev 2.x",
                                             .autodetectValue = 1,
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
                                             .scaleClkPin = 17,
                                             .scaleDat0Pin = 18,
                                             .scaleDat1Pin = 39,
                                             .sunriseSclPin = 44,
                                             .sunriseSdaPin = 43,
                                             .ext1Pin = 1,
                                             .ext2Pin = 2,
                                             .ext3Pin = 8,
                                             .ext4Pin = 12,
                                             .ext5Pin = 13,
                                             .capabilites = {
                                                 .ssrPump = true,
                                             }};

const ControllerConfig GM_PRO_REV_1x = {.name = "GaggiMate Pro Rev 1.0",
                                        .autodetectValue = 2,
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
                                        .scaleClkPin = 17,
                                        .scaleDat0Pin = 18,
                                        .scaleDat1Pin = 39,
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
                                      .scaleClkPin = 17,
                                      .scaleDat0Pin = 18,
                                      .scaleDat1Pin = 39,
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
                                        .scaleClkPin = 17,
                                        .scaleDat0Pin = 18,
                                        .scaleDat1Pin = 39,
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
                                        }};

const ControllerConfig GM_STANDARD_REV_3X = {.name = "GaggiMate Standard Rev 3.x",
                                             .autodetectValue = 6,
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
                                             .scaleClkPin = 17,
                                             .scaleDat0Pin = 18,
                                             .scaleDat1Pin = 39,
                                             .sunriseSclPin = 44,
                                             .sunriseSdaPin = 43,
                                             .ext1Pin = 1,
                                             .ext2Pin = 2,
                                             .ext3Pin = 8,
                                             .ext4Pin = 12,
                                             .ext5Pin = 13,
                                             .capabilites = {
                                                 .ssrPump = true,
                                             }};

const ControllerConfig GM_MAX_REV10 = {.name = "GaggiMate Max Rev 1.x",
                                            .autodetectValue = 5,
                                            .heaterPin = 12,
                                            .pumpPin = 41,
                                            .pumpSensePin = 42,
                                            .pumpOn = 1,
                                            .valvePin = 13,
                                            .valveOn = 1,
                                            .altPin = 10,
                                            .altOn = 1,
                                            .refillPin = 21,
                                            .auxPin = 14,
                                            .pressureScl = 47,
                                            .pressureSda = 48,
                                            .brewButtonPin = 6,
                                            .steamButtonPin = 4,
                                            .waterButtonPin = 5,
                                            .scaleClkPin = 7,
                                            .scaleDat0Pin = 15,
                                            .scaleDat1Pin = 16,
                                            .sunriseSclPin = 8,
                                            .sunriseSdaPin = 18,
                                            .tankLevelPin = 3,
                                            .waterSensePin = 38,
                                            .ledPin = 9,
                                            .ext1Pin = 2,
                                            .ext2Pin = 47,
                                            .ext3Pin = 48,
                                            .ext4Pin = 43,
                                            .ext5Pin = 44,
                                            .capabilites = {
                                                .dimming = true,
                                                .pressure = true,
                                                .dualBoiler = true,
                                            }};

#endif // CONTROLLERCONFIG_H
