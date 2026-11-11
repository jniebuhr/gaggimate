#include "MachineProfiles.h"
#include "Settings.h"
#include "SystemInfo.h"
#include <ESPAsyncWebServer.h>
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <display/util/PsramAllocator.h>
#include <display/webassets/machine_profile_schema.h>
#include <mbedtls/sha256.h>
#include <utility>
#include <vector>

namespace {
bool isObject(JsonVariantConst v) { return v.is<JsonObjectConst>(); }
bool fail(String &error, const String &text) {
    error = text;
    return false;
}
bool supportsField(JsonObjectConst field, const SystemInfo &system, bool hardware) {
    const auto &caps = system.capabilities;
    const char *required = field["capability"] | "";
    return (!field["hardware"].as<bool>() || hardware) && (strcmp(required, "pressure") != 0 || caps.pressure) &&
           (strcmp(required, "dualBoiler") != 0 || caps.dualBoiler) && (!field["singleBoiler"].as<bool>() || !caps.dualBoiler);
}
bool validateFieldValue(JsonVariantConst v, JsonObjectConst field, const char *key) {
    const char *type = field["type"] | "";
    if (!strcmp(type, "boolean"))
        return v.is<bool>();
    if (!strcmp(type, "csv")) {
        if (!v.is<const char *>())
            return false;
        const char *p = v.as<const char *>();
        unsigned count = 0;
        while (*p) {
            char *end = nullptr;
            const double n = strtod(p, &end);
            if (end == p || !std::isfinite(n) || std::fabs(n) > 1000000 ||
                ((!strcmp(key, "pid") || !strcmp(key, "steamPid")) && n < 0))
                return false;
            while (*end == ' ')
                ++end;
            ++count;
            if (!*end)
                break;
            if (*end != ',' || !end[1])
                return false;
            p = end + 1;
        }
        for (auto n : field["lengths"].as<JsonArrayConst>())
            if (count == n.as<unsigned>())
                return true;
        return false;
    }
    if (v.is<bool>() || !v.is<double>())
        return false;
    const double n = v.as<double>();
    if (!std::isfinite(n) || (!strcmp(type, "integer") && std::floor(n) != n) ||
        (!field["min"].isNull() && n < field["min"].as<double>()) || (!field["max"].isNull() && n > field["max"].as<double>()))
        return false;
    if (field["values"].is<JsonArrayConst>()) {
        for (auto item : field["values"].as<JsonArrayConst>())
            if (item.as<double>() == n)
                return true;
        return false;
    }
    return true;
}
bool isProfileCompatible(JsonObjectConst profile, const SystemInfo &system, bool hardware, String &error) {
    if (system.hardware.isEmpty())
        return fail(error, "Waiting for controller board information");
    const auto
        requires
    = profile["requires"].as<JsonObjectConst>();
    if ((!requires["pressure"].isNull() && requires["pressure"].as<bool>() != system.capabilities.pressure) ||
        (!requires["dualBoiler"].isNull() && requires["dualBoiler"].as<bool>() != system.capabilities.dualBoiler))
        return fail(error, "Machine profile capability mismatch");
    if (requires["boards"].is<JsonArrayConst>()) {
        bool found = false;
        for (auto board : requires["boards"].as<JsonArrayConst>())
            if (system.hardware == board.as<String>())
                found = true;
        if (!found)
            return fail(error, "Machine profile board mismatch");
    }
    JsonDocument schema;
    if (deserializeJson(schema, MACHINE_PROFILE_FIELDS))
        return fail(error, "Could not read machine profile schema");
    for (auto entry : profile["settings"].as<JsonObjectConst>())
        if (!supportsField(schema[entry.key()].as<JsonObjectConst>(), system, hardware))
            return fail(error, String("Unsupported machine profile setting: ") + entry.key().c_str());
    return true;
}
} // namespace

bool validateMachineProfile(JsonVariantConst value, String &error) {
    if (!isObject(value) || value["schemaVersion"] != 1 || !value["id"].is<const char *>() || !value["name"].is<const char *>() ||
        !value["revision"].is<int>() || value["revision"].as<int>() < 1 || !isObject(value["settings"]) ||
        value["settings"].size() == 0 || measureJson(value) > 3500)
        return fail(error, "Invalid machine profile format");
    const String id = value["id"].as<String>(), name = value["name"].as<String>();
    if (id.isEmpty() || id.length() > 64 || name.isEmpty() || name.length() > 64)
        return fail(error, "Invalid profile identity");
    for (unsigned i = 0; i < id.length(); ++i) {
        const char c = id[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (i && (c == '.' || c == '-' || c == '_'))))
            return fail(error, "Invalid profile identity");
    }
    for (auto entry : value.as<JsonObjectConst>()) {
        const String key = entry.key().c_str();
        if (key != "schemaVersion" && key != "id" && key != "name" && key != "revision" && key != "requires" &&
            key != "settings" && key != "plugins" && key != "locks")
            return fail(error, "Unknown profile property");
    }
    if (!value["locks"].isUnbound()) {
        if (!isObject(value["locks"]))
            return fail(error, "Invalid profile field locks");
        for (auto entry : value["locks"].as<JsonObjectConst>()) {
            if (strcmp(entry.key().c_str(), "targetSteamTemp") || !entry.value().is<bool>())
                return fail(error, "Invalid profile field locks");
        }
    }
    if (!value["requires"].isNull()) {
        if (!isObject(value["requires"]))
            return fail(error, "Invalid board requirements");
        for (auto entry : value["requires"].as<JsonObjectConst>()) {
            const String key = entry.key().c_str();
            if (key == "boards") {
                if (!entry.value().is<JsonArrayConst>() || !entry.value().size() || entry.value().size() > 16)
                    return fail(error, "Invalid board list");
                for (auto board : entry.value().as<JsonArrayConst>())
                    if (!board.is<const char *>() || board.as<String>().isEmpty() || board.as<String>().length() > 80)
                        return fail(error, "Invalid board list");
            } else if ((key != "pressure" && key != "dualBoiler") || !entry.value().is<bool>())
                return fail(error, "Invalid capability requirement");
        }
    }
    if (!value["plugins"].isNull()) {
        if (!value["plugins"].is<JsonArrayConst>())
            return fail(error, "Invalid plugin recommendations");
        for (auto plugin : value["plugins"].as<JsonArrayConst>())
            if (plugin.as<String>() != "boilerFillActive")
                return fail(error, "Unknown recommended plugin");
    }
    JsonDocument schema;
    if (deserializeJson(schema, MACHINE_PROFILE_FIELDS))
        return fail(error, "Could not read machine profile schema");
    for (auto entry : value["settings"].as<JsonObjectConst>()) {
        const auto field = schema[entry.key()].as<JsonObjectConst>();
        if (field.isNull() || !validateFieldValue(entry.value(), field, entry.key().c_str()))
            return fail(error, String("Invalid machine setting: ") + entry.key().c_str());
    }
    for (const char *prefix : {"system", "barista"}) {
        const auto minimum = value["settings"][String(prefix) + "LedMinBrightness"];
        const int maximum = value["settings"][String(prefix) + "LedBrightness"] | 255;
        if (!minimum.isNull() && minimum.as<int>() > maximum)
            return fail(error, "LED minimum brightness exceeds maximum");
    }
    return true;
}

bool validateMachineProfileRequest(AsyncWebServerRequest *request, const SystemInfo &system, bool hardware, String &error) {
    JsonDocument schema;
    if (deserializeJson(schema, MACHINE_PROFILE_FIELDS))
        return fail(error, "Could not read machine profile schema");
    for (auto entry : schema.as<JsonObject>()) {
        if (!entry.value()["hardware"].as<bool>() || !request->hasArg(entry.key().c_str()))
            continue;
        const String raw = request->arg(entry.key().c_str());
        JsonDocument value;
        const char *type = entry.value()["type"] | "";
        if (!strcmp(type, "boolean")) {
            if (raw != "0" && raw != "1")
                return fail(error, "Invalid hardware boolean");
            value.set(raw == "1");
        } else if (deserializeJson(value, raw))
            return fail(error, "Invalid hardware number");
        if (!validateFieldValue(value.as<JsonVariantConst>(), entry.value(), entry.key().c_str()))
            return fail(error, String("Invalid hardware setting: ") + entry.key().c_str());
    }
    // Recognized hardware fields must never be silently ignored by an older implementation.
    if (!hardware)
        for (auto entry : schema.as<JsonObject>())
            if (entry.value()["hardware"].as<bool>() && request->hasArg(entry.key().c_str()))
                return fail(error, "Configurable hardware support is required");
    for (const char *key : {"machineProfileSelection"}) {
        if (!request->hasArg(key))
            continue;
        const String raw = request->arg(key);
        if (!strcmp(key, "machineProfileSelection") && raw.isEmpty())
            continue;
        if (raw.length() > 3500u)
            return fail(error, "Machine profile data is too large");
        JsonDocument doc;
        if (deserializeJson(doc, raw))
            return fail(error, "Invalid machine profile JSON");
        if (isMachineProfileReference(doc.as<JsonVariantConst>()))
            continue;
        if (!validateMachineProfile(doc.as<JsonVariantConst>(), error) ||
            !isProfileCompatible(doc.as<JsonObjectConst>(), system, hardware, error))
            return false;
    }
    return true;
}

bool addMachineProfileSettings(JsonDocument &doc, const Settings &settings, const SystemInfo &system, bool hardware) {
    JsonDocument schema;
    if (deserializeJson(schema, MACHINE_PROFILE_FIELDS))
        return false;
    doc["machineProfileSelection"] = settings.getMachineProfileSelection();
    doc["machineProfileBoard"] = system.hardware;
    doc["machineProfileCapabilities"]["pressure"] = system.capabilities.pressure;
    doc["machineProfileCapabilities"]["dualBoiler"] = system.capabilities.dualBoiler;
    doc["machineProfileCapabilities"]["hardwareScale"] = system.capabilities.hwScale;
    doc["machineProfileCapabilities"]["gearpumpAddon"] = system.capabilities.hasAddon(7);
    doc["machineProfileCapabilities"]["albaAddon"] = system.capabilities.ledControl;
    doc["machineHardwareConfiguration"] = hardware;
    auto supported = doc["machineProfileSupportedFields"].to<JsonArray>();
    for (auto entry : schema.as<JsonObject>())
        if (supportsField(entry.value(), system, hardware))
            supported.add(entry.key().c_str());
    return !doc.overflowed();
}

void logMachineProfile(const char *event, const String &selection) {
    JsonDocument profile;
    if (selection.isEmpty() || deserializeJson(profile, selection)) {
        ESP_LOGI("MachineProfile", "%s: Custom", event);
        return;
    }
    ESP_LOGI("MachineProfile", "%s: id=%s hash=%s", event, profile["id"] | "", profile["hash"] | "");
}

namespace {
// Object order and whitespace are not part of a profile's identity. Let
// ArduinoJson serialize leaf values instead of maintaining a second number codec.
void canonicalProfileValue(JsonVariant target, JsonVariantConst source) {
    if (source.is<JsonObjectConst>()) {
        auto object = target.to<JsonObject>();
        std::vector<JsonPairConst> entries;
        for (auto entry : source.as<JsonObjectConst>())
            entries.push_back(entry);
        std::sort(entries.begin(), entries.end(),
                  [](JsonPairConst a, JsonPairConst b) { return strcmp(a.key().c_str(), b.key().c_str()) < 0; });
        for (auto entry : entries)
            canonicalProfileValue(object[entry.key()].to<JsonVariant>(), entry.value());
    } else if (source.is<JsonArrayConst>()) {
        auto array = target.to<JsonArray>();
        for (auto value : source.as<JsonArrayConst>())
            canonicalProfileValue(array.add<JsonVariant>(), value);
    } else {
        target.set(source);
    }
}
} // namespace

String machineProfileHash(JsonVariantConst profile) {
    JsonDocument canonical(&psramAllocator);
    canonicalProfileValue(canonical.to<JsonVariant>(), profile);
    if (canonical.overflowed())
        return "";
    String serialized;
    if (serializeJson(canonical, serialized) != measureJson(canonical) || serialized.length() != measureJson(canonical))
        return "";
    uint8_t digest[32];
    if (mbedtls_sha256_ret(reinterpret_cast<const unsigned char *>(serialized.c_str()), serialized.length(), digest, 0))
        return "";
    // A 64-bit definition fingerprint keeps the saved reference small. This is
    // change detection, not an authenticity check (OTA verifies its own images).
    char result[17];
    for (unsigned i = 0; i < 8; ++i)
        snprintf(result + i * 2, 3, "%02x", static_cast<unsigned>(digest[i]));
    return String(result);
}

bool machineProfileReference(const String &selection, String &result) {
    if (selection.isEmpty()) {
        result = "";
        return true;
    }
    JsonDocument profile;
    if (deserializeJson(profile, selection))
        return false;
    if (isMachineProfileReference(profile.as<JsonVariantConst>())) {
        String reference = selection;
        if (reference != selection)
            return false;
        result = std::move(reference);
        return true;
    }
    if (!profile["settings"].is<JsonObjectConst>())
        return false;
    const String hash = machineProfileHash(profile.as<JsonVariantConst>());
    if (hash.length() != 16)
        return false;
    JsonDocument reference;
    reference["id"] = profile["id"];
    reference["hash"] = hash;
    if (profile["locks"].is<JsonObjectConst>())
        reference["locks"] = profile["locks"];
    if (reference.overflowed() || !isMachineProfileReference(reference.as<JsonVariantConst>()))
        return false;
    String serialized;
    if (serializeJson(reference, serialized) != measureJson(reference) || serialized.length() != measureJson(reference))
        return false;
    result = std::move(serialized);
    return true;
}

bool isMachineProfileReference(JsonVariantConst value) {
    if (!value.is<JsonObjectConst>() || !value["id"].is<const char *>() || !value["hash"].is<const char *>())
        return false;
    const String id = value["id"].as<String>(), hash = value["hash"].as<String>();
    if (id.isEmpty() || id.length() > 64 || hash.length() != 16)
        return false;
    for (unsigned i = 0; i < id.length(); ++i) {
        const char c = id[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (i && (c == '.' || c == '-' || c == '_'))))
            return false;
    }
    for (unsigned i = 0; i < hash.length(); ++i)
        if (!((hash[i] >= '0' && hash[i] <= '9') || (hash[i] >= 'a' && hash[i] <= 'f')))
            return false;
    for (auto entry : value.as<JsonObjectConst>())
        if (strcmp(entry.key().c_str(), "id") && strcmp(entry.key().c_str(), "hash") && strcmp(entry.key().c_str(), "locks"))
            return false;
    if (!value["locks"].isUnbound()) {
        if (!value["locks"].is<JsonObjectConst>())
            return false;
        for (auto entry : value["locks"].as<JsonObjectConst>())
            if (strcmp(entry.key().c_str(), "targetSteamTemp") || !entry.value().is<bool>())
                return false;
    }
    return true;
}

bool loadBuiltinMachineProfile(const String &id, JsonDocument &profile) {
    JsonDocument catalog(&psramAllocator);
    if (deserializeJson(catalog, MACHINE_PROFILE_BUILTINS))
        return false;
    for (JsonObjectConst entry : catalog.as<JsonArrayConst>()) {
        if (entry["id"].as<String>() == id) {
            profile.set(entry);
            return true;
        }
    }
    return false;
}

void addBuiltinMachineProfiles(JsonArray result) {
    JsonDocument catalog(&psramAllocator);
    if (deserializeJson(catalog, MACHINE_PROFILE_BUILTINS))
        return;
    for (JsonObjectConst profile : catalog.as<JsonArrayConst>()) {
        auto metadata = result.add<JsonObject>();
        for (const char *key : {"id", "name", "revision", "requires"})
            metadata[key] = profile[key];
        metadata["hash"] = machineProfileHash(profile);
    }
}
