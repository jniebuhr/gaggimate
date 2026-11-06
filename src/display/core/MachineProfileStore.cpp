#include "MachineProfileStore.h"
#include "MachineProfiles.h"
#include <algorithm>
#include <display/util/FsUtil.h>
#include <display/util/PsramAllocator.h>
#include <display/webassets/machine_profile_schema.h>
#include <vector>

namespace {
constexpr size_t MAX_PROFILES = 64;
constexpr size_t MAX_PROFILE_BYTES = 3500; // Selected snapshot still fits an NVS string.
const char *DIRECTORY = "/m";
String path(const String &id, const char *extension = ".json") { return String(DIRECTORY) + "/" + id + extension; }
bool fail(String &error, const char *message) {
    error = message;
    return false;
}
bool builtinId(const String &id) {
    JsonDocument ids;
    if (deserializeJson(ids, MACHINE_PROFILE_BUILTIN_IDS))
        return true;
    for (auto item : ids.as<JsonArrayConst>())
        if (id == item.as<String>())
            return true;
    return false;
}
} // namespace
bool MachineProfileStore::validId(const String &id) {
    if (id.isEmpty() || id.length() > 64)
        return false;
    for (unsigned i = 0; i < id.length(); ++i) {
        const char c = id[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (i && (c == '.' || c == '-' || c == '_'))))
            return false;
    }
    return true;
}
bool MachineProfileStore::ensureDirectory(String &error) {
    return fs.exists(DIRECTORY) || fs.mkdir(DIRECTORY) || fail(error, "Could not open machine profile storage");
}
bool MachineProfileStore::loadUnlocked(const String &id, JsonDocument &profile, String &error) {
    if (!validId(id))
        return fail(error, "Invalid machine profile ID");
    const String filePath = path(id), backup = path(id, ".bak");
    // Recover an interrupted replacement. The applied NVS settings never depend on this file.
    if (!fs.exists(filePath) && fs.exists(backup) && !fs.rename(backup.c_str(), filePath.c_str()))
        return fail(error, "Could not recover machine profile");
    File file = fs.open(filePath, "r");
    if (!file || file.isDirectory())
        return fail(error, "Machine profile not found");
    if (file.size() > MAX_PROFILE_BYTES) {
        file.close();
        return fail(error, "Machine profile is too large");
    }
    const auto result = deserializeJson(profile, file);
    file.close();
    if (result || !validateMachineProfile(profile.as<JsonVariantConst>(), error) || profile["id"].as<String>() != id)
        return fail(error, "Invalid stored machine profile");
    return true;
}
bool MachineProfileStore::load(const String &id, JsonDocument &profile, String &error) {
    std::lock_guard<std::mutex> guard(mutex);
    return loadUnlocked(id, profile, error);
}
bool MachineProfileStore::listUnlocked(JsonArray result, String &error) {
    if (!ensureDirectory(error))
        return false;
    File root = fs.open(DIRECTORY);
    if (!root || !root.isDirectory())
        return fail(error, "Could not list machine profiles");
    // Close directory handles before opening profile files, as ProfileManager does.
    std::vector<String> ids;
    File entry = root.openNextFile();
    while (entry) {
        String name = entry.name();
        const bool regular = !entry.isDirectory();
        entry.close();
        name = name.substring(name.lastIndexOf('/') + 1);
        const bool backup = name.endsWith(".bak");
        if (regular && !fs_util::isHiddenPath(name) && (name.endsWith(".json") || backup)) {
            const String id = name.substring(0, name.length() - (backup ? 4 : 5));
            if (validId(id) && !builtinId(id) && std::find(ids.begin(), ids.end(), id) == ids.end())
                ids.push_back(id);
        }
        if (ids.size() > MAX_PROFILES) {
            root.close();
            return fail(error, "Too many imported machine profiles");
        }
        entry = root.openNextFile();
    }
    root.close();
    for (const auto &id : ids) {
        JsonDocument profile(&psramAllocator);
        String readError;
        if (!loadUnlocked(id, profile, readError)) {
            ESP_LOGW("MachineProfile", "Skipping unreadable profile %s", id.c_str());
            continue;
        }
        auto metadata = result.add<JsonObject>();
        for (const char *key : {"id", "name", "revision", "requires"})
            metadata[key] = profile[key];
        auto settingKeys = metadata["settingKeys"].to<JsonArray>();
        for (auto entry : profile["settings"].as<JsonObjectConst>())
            settingKeys.add(entry.key().c_str());
        metadata["hash"] = machineProfileHash(profile.as<JsonVariantConst>());
    }
    return true;
}
bool MachineProfileStore::list(JsonArray result, String &error) {
    std::lock_guard<std::mutex> guard(mutex);
    return listUnlocked(result, error);
}
bool MachineProfileStore::save(JsonVariantConst profile, String &error, bool replace) {
    std::lock_guard<std::mutex> guard(mutex);
    if (!validateMachineProfile(profile, error))
        return false;
    const String id = profile["id"].as<String>();
    if (!validId(id))
        return fail(error, "Invalid machine profile ID");
    if (builtinId(id))
        return fail(error, "Use a different ID for a customized built-in profile");
    if (!ensureDirectory(error))
        return false;
    const String target = path(id), temporary = path(id, ".tmp"), backup = path(id, ".bak");
    if (!replace && (fs.exists(target) || fs.exists(backup)))
        return fail(error, "This profile already exists; reload the library before replacing it");
    if (!fs.exists(target) && !fs.exists(backup)) {
        JsonDocument catalog(&psramAllocator);
        if (!listUnlocked(catalog.to<JsonArray>(), error))
            return false;
        if (catalog.size() >= MAX_PROFILES)
            return fail(error, "Imported machine profile library is full");
    }
    File file = fs.open(temporary, "w");
    if (!file)
        return fail(error, "Could not write machine profile");
    const size_t written = serializeJson(profile, file);
    file.flush();
    file.close();
    if (written != measureJson(profile)) {
        fs.remove(temporary);
        return fail(error, "Could not write complete machine profile");
    }
    if (fs.exists(target)) {
        if ((fs.exists(backup) && !fs.remove(backup)) || !fs.rename(target.c_str(), backup.c_str())) {
            fs.remove(temporary);
            return fail(error, "Could not replace machine profile");
        }
    }
    if (!fs.rename(temporary.c_str(), target.c_str())) {
        if (fs.exists(backup))
            fs.rename(backup.c_str(), target.c_str());
        fs.remove(temporary);
        return fail(error, "Could not store machine profile");
    }
    fs.remove(backup);
    return true;
}
bool MachineProfileStore::remove(const String &id, String &error) {
    std::lock_guard<std::mutex> guard(mutex);
    if (!validId(id) || builtinId(id))
        return fail(error, "Invalid imported machine profile ID");
    const String target = path(id), backup = path(id, ".bak");
    if (fs.exists(backup) && !fs.remove(backup))
        return fail(error, "Could not delete machine profile backup");
    fs.remove(path(id, ".tmp"));
    return !fs.exists(target) || fs.remove(target) || fail(error, "Could not delete machine profile");
}
