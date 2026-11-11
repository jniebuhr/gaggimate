#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

class AsyncWebServerRequest;
class Settings;
struct SystemInfo;

// Profiles use the ordinary settings API; this only validates their envelope and subset.
bool validateMachineProfile(JsonVariantConst value, String &error);
bool validateMachineProfileRequest(AsyncWebServerRequest *request, const SystemInfo &system, bool hardwareSupported,
                                   String &error);
bool addMachineProfileSettings(JsonDocument &doc, const Settings &settings, const SystemInfo &system, bool hardwareSupported);

void logMachineProfile(const char *event, const String &selection);

String machineProfileHash(JsonVariantConst profile);
bool machineProfileReference(const String &selection, String &result);
bool isMachineProfileReference(JsonVariantConst value);

bool loadBuiltinMachineProfile(const String &id, JsonDocument &profile);
void addBuiltinMachineProfiles(JsonArray result);
