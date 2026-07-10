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
    std::vector<uint32_t> addons;

    bool hasAddon(uint32_t addon) const { return std::find(addons.begin(), addons.end(), addon) != addons.end(); }
};

struct SystemInfo {
    String hardware;
    String version;
    SystemCapabilities capabilities;
    uint32_t protocolVersion = 0;  // controller's protocol version (0 = unknown)
    bool protocolMismatch = false; // set when it differs from the display's
};

#endif // DISPLAY_SYSTEM_INFO_H
