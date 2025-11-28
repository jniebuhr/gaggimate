#ifndef UTILITIES_H
#define UTILITIES_H
#include "ControllerConfig.h"
#include <Arduino.h>
#include <ArduinoJson.h>

inline String make_system_info(ControllerConfig config, String version) {
    JsonDocument doc;
    doc["hw"] = config.name;
    doc["v"] = version;
    JsonDocument capabilities;
    capabilities["ps"] = config.capabilites.pressure;
    capabilities["dm"] = config.capabilites.dimming;
    capabilities["led"] = config.capabilites.ledControls;
    capabilities["tof"] = config.capabilites.tof;
    doc["cp"] = capabilities;
    return doc.as<String>();
}

#endif // UTILITIES_H
