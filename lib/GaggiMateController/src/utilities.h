#ifndef UTILITIES_H
#define UTILITIES_H
#include "ControllerConfig.h"
#include <Arduino.h>
#include <ArduinoJson.h>

inline String make_system_info(ControllerConfig config) {
    JsonDocument doc;
    doc["hardware"] = config.name;
    doc["version"] = BUILD_GIT_VERSION;
    JsonDocument capabilities;
    capabilities["pressure"] = config.capabilites.pressure;
    capabilities["dimming"] = config.capabilites.dimming;
    doc["capabilities"] = capabilities;
    return doc.as<String>();
}

#endif // UTILITIES_H
