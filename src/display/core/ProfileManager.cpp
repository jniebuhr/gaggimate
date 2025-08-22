#include "ProfileManager.h"
#include <ArduinoJson.h>

#include <utility>

ProfileManager::ProfileManager(fs::FS &fs, String dir, Settings &settings, PluginManager *plugin_manager)
    : _plugin_manager(plugin_manager), _settings(settings), _fs(fs), _dir(std::move(dir)) {}

void ProfileManager::setup() {
    ensureDirectory();
    auto profiles = listProfiles();
    if (!_settings.isProfilesMigrated() || profiles.empty()) {
        migrate();
        _settings.setProfilesMigrated(true);
    }
    loadSelectedProfile(selectedProfile);
    _settings.setFavoritedProfiles(getFavoritedProfiles(true));
}

bool ProfileManager::ensureDirectory() const {
    if (!_fs.exists(_dir)) {
        return _fs.mkdir(_dir);
    }
    return true;
}

String ProfileManager::profilePath(const String &uuid) const { return _dir + "/" + uuid + ".json"; }

void ProfileManager::migrate() {
    Profile profile{};
    profile.id = generateShortID();
    profile.label = "Default";
    profile.description = "Default profile generated from previous settings";
    profile.temperature = _settings.getTargetBrewTemp();
    profile.type = "standard";
    if (_settings.getPressurizeTime() > 0) {
        Phase pressurizePhase1{};
        pressurizePhase1.name = "Pressurize";
        pressurizePhase1.phase = PhaseType::PHASE_TYPE_PREINFUSION;
        pressurizePhase1.valve = 0;
        pressurizePhase1.duration = _settings.getPressurizeTime() / 1000;
        pressurizePhase1.pumpIsSimple = true;
        pressurizePhase1.pumpSimple = 100;
        profile.phases.push_back(pressurizePhase1);
    }
    if (_settings.getInfusePumpTime() > 0) {
        Phase infusePumpPhase{};
        infusePumpPhase.name = "Bloom";
        infusePumpPhase.phase = PhaseType::PHASE_TYPE_BREW;
        infusePumpPhase.valve = 1;
        infusePumpPhase.duration = _settings.getInfusePumpTime() / 1000;
        infusePumpPhase.pumpIsSimple = true;
        infusePumpPhase.pumpSimple = 100;
        profile.phases.push_back(infusePumpPhase);
    }
    if (_settings.getInfuseBloomTime() > 0) {
        Phase infuseBloomPhase1{};
        infuseBloomPhase1.name = "Bloom";
        infuseBloomPhase1.phase = PhaseType::PHASE_TYPE_BREW;
        infuseBloomPhase1.valve = 1;
        infuseBloomPhase1.duration = _settings.getInfuseBloomTime() / 1000;
        infuseBloomPhase1.pumpIsSimple = true;
        infuseBloomPhase1.pumpSimple = 0;
        profile.phases.push_back(infuseBloomPhase1);
    }
    if (_settings.getPressurizeTime() > 0) {
        Phase pressurizePhase1{};
        pressurizePhase1.name = "Pressurize";
        pressurizePhase1.phase = PhaseType::PHASE_TYPE_BREW;
        pressurizePhase1.valve = 0;
        pressurizePhase1.duration = _settings.getPressurizeTime() / 1000;
        pressurizePhase1.pumpIsSimple = true;
        pressurizePhase1.pumpSimple = 100;
        profile.phases.push_back(pressurizePhase1);
    }
    Phase brewPhase{};
    brewPhase.name = "Brew";
    brewPhase.phase = PhaseType::PHASE_TYPE_BREW;
    brewPhase.valve = 1;
    brewPhase.duration = _settings.getTargetDuration() / 1000;
    brewPhase.pumpIsSimple = true;
    brewPhase.pumpSimple = 100;
    Target target{};
    target.type = TargetType::TARGET_TYPE_VOLUMETRIC;
    target.value = _settings.getTargetVolume();
    brewPhase.targets.push_back(target);
    profile.phases.push_back(brewPhase);
    saveProfile(profile);
    _settings.setSelectedProfile(profile.id);
    _settings.addFavoritedProfile(profile.id);
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

    std::vector<String> ordered;
    auto stored = _settings.getProfileOrder();
    for (auto const &id : stored) {
        if (std::find(uuids.begin(), uuids.end(), id) != uuids.end() &&
            std::find(ordered.begin(), ordered.end(), id) == ordered.end()) {
            ordered.push_back(id);
        }
    }
    for (auto const &id : uuids) {
        if (std::find(ordered.begin(), ordered.end(), id) == ordered.end()) {
            ordered.push_back(id);
        }
    }
    return ordered;
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

    if (!parseProfile(doc.as<JsonObject>(), outProfile)) {
        return false;
    }
    outProfile.selected = outProfile.id == _settings.getSelectedProfile();
    std::vector<String> favoritedProfiles = _settings.getFavoritedProfiles();
    outProfile.favorite = std::find(favoritedProfiles.begin(), favoritedProfiles.end(), outProfile.id) != favoritedProfiles.end();
    return true;
}

bool ProfileManager::saveProfile(Profile &profile) {
    if (!ensureDirectory())
        return false;
    bool isNew = false;

    if (profile.id == nullptr || profile.id.isEmpty()) {
        profile.id = generateShortID();
        isNew = true;
    }

    ESP_LOGI("ProfileManager", "Saving profile %s", profile.id.c_str());

    File file = _fs.open(profilePath(profile.id), "w");
    if (!file)
        return false;

    JsonDocument doc;
    JsonObject obj = doc.to<JsonObject>();
    writeProfile(obj, profile);

    bool ok = serializeJson(doc, file) > 0;
    file.close();
    if (profile.id == selectedProfile.id) {
        selectedProfile = Profile{};
        loadSelectedProfile(selectedProfile);
    }
    selectProfile(_settings.getSelectedProfile());
    _plugin_manager->trigger("profiles:profile:save", "id", profile.id);
    if (isNew) {
        _settings.addFavoritedProfile(profile.id);
    }
    return ok;
}

bool ProfileManager::deleteProfile(const String &uuid) {
    _settings.removeFavoritedProfile(uuid);
    return _fs.remove(profilePath(uuid));
}

bool ProfileManager::profileExists(const String &uuid) { return _fs.exists(profilePath(uuid)); }

void ProfileManager::selectProfile(const String &uuid) {
    ESP_LOGI("ProfileManager", "Selecting profile %s", uuid.c_str());
    _settings.setSelectedProfile(uuid);
    selectedProfile = Profile{};
    loadSelectedProfile(selectedProfile);
    _plugin_manager->trigger("profiles:profile:select", "id", uuid);
}

Profile ProfileManager::getSelectedProfile() const { return selectedProfile; }

void ProfileManager::loadSelectedProfile(Profile &outProfile) { loadProfile(_settings.getSelectedProfile(), outProfile); }

std::vector<String> ProfileManager::getFavoritedProfiles(bool validate) {

    auto rawFavorites = _settings.getFavoritedProfiles();
    std::vector<String> result;

    auto storedProfileOrder = _settings.getProfileOrder();
    for (const auto &id : storedProfileOrder) {
        if (std::find(rawFavorites.begin(), rawFavorites.end(), id) != rawFavorites.end()) {
            if (!validate || profileExists(id)) {
                if (std::find(result.begin(), result.end(), id) == result.end()) {
                    result.push_back(id);
                }
            }
        }
    }

    for (const auto &fav : rawFavorites) {
        if (std::find(result.begin(), result.end(), fav) == result.end()) {
            if (!validate || profileExists(fav)) {
                result.push_back(fav);
            }
        }
    }

    if (result.empty()) {
        String sel = _settings.getSelectedProfile();
        bool selValid = (!validate) ||  profileExists(sel);
        if (selValid) {
            result.push_back(sel);
        }
    }
    return result;
}
