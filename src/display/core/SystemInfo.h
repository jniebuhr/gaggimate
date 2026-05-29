#ifndef DISPLAY_SYSTEM_INFO_H
#define DISPLAY_SYSTEM_INFO_H

#include <Arduino.h>

// Controller capabilities + identity as the display tracks them. Populated from
// the SystemInfo message the controller pushes on connect. (Previously lived in
// the NimBLEComm library.)
struct SystemCapabilities {
    bool dimming;
    bool pressure;
    bool ledControl;
    bool tof;
};

struct SystemInfo {
    String hardware;
    String version;
    SystemCapabilities capabilities;
};

#endif // DISPLAY_SYSTEM_INFO_H
