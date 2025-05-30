#include "ProfileManager.h"
#include <ArduinoJson.h>
#include <display/core/utils.h>

ProfileManager::ProfileManager(fs::FS &fs, const char *dir, Settings &settings) : _fs(fs), _dir(dir), _settings(settings) {}

void ProfileManager::setup() {
    ensureDirectory();
    if (!_settings.isProfilesMigrated()) {
        migrate();
        _settings.setProfilesMigrated(true);
    }
}

bool ProfileManager::ensureDirectory() {
    if (!_fs.exists(_dir)) {
        return _fs.mkdir(_dir);
    }
    return true;
}

String ProfileManager::profilePath(const String &uuid) { return _dir + "/" + uuid + ".json"; }

void ProfileManager::migrate() {
    Profile profile{};
    profile.id = generateShortID();
    profile.label = "Default";
    profile.description = "Default profile generated from previous settings";
    profile.temperature = _settings.getTargetBrewTemp();
    profile.favorite = true;
    profile.type = "standard";
    if (_settings.getPressurizeTime() > 0) {
        Phase pressurizePhase1{};
        pressurizePhase1.name = "Pressurize";
        pressurizePhase1.phase = PhaseType::PHASE_TYPE_PREINFUSION;
        pressurizePhase1.valve = 0;
        pressurizePhase1.duration = _settings.getPressurizeTime();
        pressurizePhase1.pumpIsSimple = true;
        pressurizePhase1.pumpSimple = 100;
        profile.phases.push_back(pressurizePhase1);
    }
    if (_settings.getInfusePumpTime() > 0) {
        Phase infusePumpPhase{};
        infusePumpPhase.name = "Bloom";
        infusePumpPhase.phase = PhaseType::PHASE_TYPE_BREW;
        infusePumpPhase.valve = 1;
        infusePumpPhase.duration = _settings.getInfusePumpTime();
        infusePumpPhase.pumpIsSimple = true;
        infusePumpPhase.pumpSimple = 100;
        profile.phases.push_back(infusePumpPhase);
    }
    if (_settings.getInfuseBloomTime() > 0) {
        Phase infuseBloomPhase1{};
        infuseBloomPhase1.name = "Bloom";
        infuseBloomPhase1.phase = PhaseType::PHASE_TYPE_BREW;
        infuseBloomPhase1.valve = 1;
        infuseBloomPhase1.duration = _settings.getInfuseBloomTime();
        infuseBloomPhase1.pumpIsSimple = true;
        infuseBloomPhase1.pumpSimple = 0;
        profile.phases.push_back(infuseBloomPhase1);
    }
    if (_settings.getPressurizeTime() > 0) {
        Phase pressurizePhase1{};
        pressurizePhase1.name = "Pressurize";
        pressurizePhase1.phase = PhaseType::PHASE_TYPE_BREW;
        pressurizePhase1.valve = 0;
        pressurizePhase1.duration = _settings.getPressurizeTime();
        pressurizePhase1.pumpIsSimple = true;
        pressurizePhase1.pumpSimple = 100;
        profile.phases.push_back(pressurizePhase1);
    }
    Phase brewPhase{};
    brewPhase.name = "Brew";
    brewPhase.phase = PhaseType::PHASE_TYPE_BREW;
    brewPhase.valve = 1;
    brewPhase.duration = _settings.getTargetDuration();
    brewPhase.pumpIsSimple = true;
    brewPhase.pumpSimple = 100;
    Target target{};
    target.type = TargetType::TARGET_TYPE_VOLUMETRIC;
    target.value = _settings.getTargetVolume();
    brewPhase.targets.push_back(target);
    profile.phases.push_back(brewPhase);
    saveProfile(profile);
    _settings.setSelectedProfile(profile.id);
}

std::vector<String> ProfileManager::listProfiles() {
    std::vector<String> uuids;
    File root = _fs.open(_dir);
    if (!root || !root.isDirectory())
        return uuids;

    File file = root.openNextFile();
    while (file) {
        String name = file.name();
        if (name.endsWith(".json")) {
            int start = name.lastIndexOf('/') + 1;
            int end = name.lastIndexOf('.');
            uuids.push_back(name.substring(start, end));
        }
        file = root.openNextFile();
    }
    return uuids;
}

bool ProfileManager::loadProfile(const String &uuid, Profile &outProfile) {
    File file = _fs.open(profilePath(uuid), "r");
    if (!file)
        return false;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, file);
    file.close();
    if (err)
        return false;

    return parseProfile(doc.as<JsonObject>(), outProfile);
}

bool ProfileManager::saveProfile(Profile &profile) {
    if (!ensureDirectory())
        return false;

    if (!profile.id) {
        profile.id = generateShortID();
    }

    File file = _fs.open(profilePath(profile.id), "w");
    if (!file)
        return false;

    JsonDocument doc;
    JsonObject obj = doc.to<JsonObject>();
    writeProfile(obj, profile);

    bool ok = serializeJson(doc, file) > 0;
    file.close();
    return ok;
}

bool ProfileManager::deleteProfile(const String &uuid) { return _fs.remove(profilePath(uuid)); }

bool ProfileManager::profileExists(const String &uuid) { return _fs.exists(profilePath(uuid)); }

void ProfileManager::selectProfile(const String &uuid) const { _settings.setSelectedProfile(uuid); }

String ProfileManager::getSelectedProfile() const { return _settings.getSelectedProfile(); }

void ProfileManager::loadSelectedProfile(Profile &outProfile) { loadProfile(_settings.getSelectedProfile(), outProfile); }
