#include "ProfileManager.h"
#include <ArduinoJson.h>
#include <display/core/ProfileImage.h>
#include <display/core/system_profiles.h>
#include <display/util/PsramAllocator.h>
#include <esp32-hal-psram.h>

#include <utility>

ProfileManager::ProfileManager(fs::FS *fs, String dir, Settings &settings, PluginManager *plugin_manager)
    : _plugin_manager(plugin_manager), _settings(settings), _fs(fs), _dir(std::move(dir)) {}

void ProfileManager::setup() {
    ensureDirectory();
    // Created up front so listing it later never takes the noisy missing-path fallback in the Arduino VFS.
    if (!_fs->exists(profile_image::DIR))
        _fs->mkdir(profile_image::DIR);
    // Call listProfiles once; each call scans the filesystem and (historically)
    // burned a file handle. Reuse this snapshot for both the entry guard and
    // the migrate() call so we hit the FS as little as possible at boot.
    auto profiles = listProfiles();
    const bool needsMigrate = profiles.empty() || getFavoritedProfiles().empty() || _settings.getSelectedProfile() == "" ||
                              !loadSelectedProfile(selectedProfile);
    if (needsMigrate) {
        migrate(profiles);
        // Reset before reload: parseProfile() appends to profile.phases. The
        // earlier loadSelectedProfile in `needsMigrate` may have pushed phases
        // before failing validation, leaving partial state that this reload
        // would double. Defensive — current paths almost never hit this.
        selectedProfile = Profile{};
        loadSelectedProfile(selectedProfile);
    }
    ensureSystemProfiles();
    _settings.setFavoritedProfiles(getFavoritedProfiles(true));

    String startupProfile = _settings.getStartupProfile();
    if (!startupProfile.isEmpty()) {
        // Validate profile integrity by loading it
        Profile testProfile{};
        if (loadProfile(startupProfile, testProfile)) {
            selectProfile(startupProfile);
        } else {
            ESP_LOGW("ProfileManager", "Startup profile %s not found or invalid, resetting", startupProfile.c_str());
            _settings.setStartupProfile("");
        }
    }
}

bool ProfileManager::ensureDirectory() const {
    if (!_fs->exists(_dir)) {
        return _fs->mkdir(_dir);
    }
    return true;
}

bool ProfileManager::isSystemProfile(const String &uuid) { return uuid == BACKFLUSH_PROFILE_ID || uuid == DESCALING_PROFILE_ID; }

void ProfileManager::ensureSystemProfiles() {
    Profile seeds[] = {makeBackflushProfile(BACKFLUSH_PROFILE_ID), makeDescalingProfile(DESCALING_PROFILE_ID)};
    for (Profile &seed : seeds) {
        if (profileExists(seed.id))
            continue;
        if (saveProfile(seed))
            ESP_LOGI("ProfileManager", "Created system profile %s", seed.id.c_str());
        else
            ESP_LOGE("ProfileManager", "Failed to create system profile %s", seed.id.c_str());
    }
}

String ProfileManager::profilePath(const String &uuid) const { return _dir + "/" + uuid + ".json"; }

void ProfileManager::migrate(const std::vector<String> &existingProfiles) {
    // Reuse an already-loaded Default if present so we don't accumulate one per
    // boot when a transient SD read fails. Without this guard, every
    // intermittent loadSelectedProfile() failure (e.g. SD pull-up jitter)
    // triggers migrate() → fresh Default → favorites list grows endlessly.
    for (const String &existingId : existingProfiles) {
        Profile existing{};
        if (!loadProfile(existingId, existing)) {
            ESP_LOGW("ProfileManager", "Skipping unreadable profile %s during migrate", existingId.c_str());
            continue;
        }
        if (existing.label == "Default") {
            // existing.id comes from parsed JSON and may be empty if the file
            // was hand-edited or pre-dates the id field. Fall back to
            // existingId (the filename-derived id) so we never set an empty
            // selected/favorite profile.
            const String resolvedId = existing.id.isEmpty() ? existingId : existing.id;
            _settings.setSelectedProfile(resolvedId);
            addFavoritedProfile(resolvedId);
            // Favorite every other profile too — without this, only the
            // reused Default ends up in favorites and the UI collapses to a
            // single entry even when more profiles exist on disk. Matches
            // the create-new-Default branch below.
            for (const String &id : existingProfiles) {
                if (id != existingId)
                    addFavoritedProfile(id);
            }
            ESP_LOGI("ProfileManager", "Reusing existing Default profile %s", resolvedId.c_str());
            return;
        }
    }

    Profile profile{};
    profile.id = generateShortID();
    profile.label = "Default";
    profile.description = "Default profile";
    profile.temperature = 93;
    profile.type = "standard";
    Phase brewPhase{};
    brewPhase.name = "Brew";
    brewPhase.phase = PhaseType::PHASE_TYPE_BREW;
    brewPhase.valve = 1;
    brewPhase.duration = 28;
    brewPhase.pumpIsSimple = true;
    brewPhase.pumpSimple = 100;
    Target target{};
    target.type = TargetType::TARGET_TYPE_VOLUMETRIC;
    target.operator_ = TargetOperator::GTE;
    target.value = 36;
    brewPhase.targets.push_back(target);
    profile.phases.push_back(brewPhase);
    if (!saveProfile(profile)) {
        ESP_LOGE("ProfileManager", "Failed to save Default profile during migrate");
        return;
    }
    _settings.setSelectedProfile(profile.id);
    // Favorite the new Default plus any other profiles found earlier in this
    // boot — same behavior as before but driven by the already-collected list.
    addFavoritedProfile(profile.id);
    for (const String &id : existingProfiles) {
        addFavoritedProfile(id);
    }
}

std::vector<String> ProfileManager::listProfiles() {
    std::vector<String> uuids;
    File root = _fs->open(_dir);
    if (!root || !root.isDirectory()) {
        if (root)
            root.close();
        return uuids;
    }

    File file = root.openNextFile();
    while (file) {
        String name = file.name();
        if (name.endsWith(".json")) {
            int start = name.lastIndexOf('/') + 1;
            int end = name.lastIndexOf('.');
            uuids.push_back(name.substring(start, end));
        }
        file.close();
        file = root.openNextFile();
    }
    // SPIFFS has a small open-file table; failing to close the directory
    // handle here exhausts it within ~30 list calls and causes subsequent
    // loadProfile open() calls to fail silently — the root cause of profiles
    // disappearing from the UI once the user has many of them on SD/SPIFFS.
    root.close();

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
    File file = _fs->open(profilePath(uuid), "r");
    if (!file)
        return false;

    JsonDocument doc(&psramAllocator);
    DeserializationError err = deserializeJson(doc, file);
    file.close();
    if (err)
        return false;

    if (!parseProfile(doc.as<JsonObject>(), outProfile)) {
        return false;
    }
    outProfile.selected = outProfile.id == _settings.getSelectedProfile();
    const auto &favoritedProfiles = _settings.getFavoritedProfiles();
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

    if (isSystemProfile(profile.id))
        profile.utility = true;

    ESP_LOGI("ProfileManager", "Saving profile %s", profile.id.c_str());

    File file = _fs->open(profilePath(profile.id), "w");
    if (!file)
        return false;

    JsonDocument doc(&psramAllocator);
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
        addFavoritedProfile(profile.id);
    }
    return ok;
}

bool ProfileManager::deleteProfile(const String &uuid) {
    if (isSystemProfile(uuid)) {
        ESP_LOGW("ProfileManager", "Refusing to delete system profile %s", uuid.c_str());
        return false;
    }
    removeFavoritedProfile(uuid);
    if (_settings.getStartupProfile() == uuid) {
        _settings.setStartupProfile("");
    }
    if (hasProfileImage(uuid)) {
        _fs->remove(profile_image::path(uuid));
    }
    return _fs->remove(profilePath(uuid));
}

bool ProfileManager::profileExists(const String &uuid) { return _fs->exists(profilePath(uuid)); }

bool ProfileManager::hasProfileImage(const String &uuid) {
    return profile_image::isValidId(uuid) && _fs->exists(profile_image::path(uuid));
}

std::vector<String> ProfileManager::listProfileImages() {
    std::vector<String> ids;
    File root = _fs->open(profile_image::DIR);
    if (!root || !root.isDirectory()) {
        if (root)
            root.close();
        return ids;
    }
    // Names only: openNextFile() would fopen every entry against the 10-file SD_MMC limit.
    bool isDir = false;
    for (String name = root.getNextFileName(&isDir); !name.isEmpty(); name = root.getNextFileName(&isDir)) {
        if (isDir || !name.endsWith(".bin"))
            continue;
        ids.push_back(name.substring(name.lastIndexOf('/') + 1, name.lastIndexOf('.')));
    }
    root.close();
    return ids;
}

uint8_t *ProfileManager::loadProfileImage(const String &uuid) {
    if (!profile_image::isValidId(uuid))
        return nullptr;
    File file = _fs->open(profile_image::path(uuid), "r");
    if (!file)
        return nullptr;
    uint32_t header = 0;
    const size_t pixelBytes = profile_image::FILE_BYTES - profile_image::HEADER_BYTES;
    if (file.size() != profile_image::FILE_BYTES ||
        file.read(reinterpret_cast<uint8_t *>(&header), sizeof(header)) != sizeof(header) || header != profile_image::HEADER) {
        file.close();
        return nullptr;
    }
    auto *pixels = static_cast<uint8_t *>(ps_malloc(pixelBytes));
    if (pixels != nullptr && file.read(pixels, pixelBytes) != pixelBytes) {
        free(pixels);
        pixels = nullptr;
    }
    file.close();
    return pixels;
}

void ProfileManager::selectProfile(const String &uuid) {
    ESP_LOGI("ProfileManager", "Selecting profile %s", uuid.c_str());
    _settings.setSelectedProfile(uuid);
    selectedProfile = Profile{};
    loadSelectedProfile(selectedProfile);
    _plugin_manager->trigger("profiles:profile:select", "id", uuid);
}

Profile &ProfileManager::getSelectedProfile() { return selectedProfile; }

bool ProfileManager::loadSelectedProfile(Profile &outProfile) { return loadProfile(_settings.getSelectedProfile(), outProfile); }

std::vector<String> ProfileManager::getFavoritedProfiles(bool validate) {

    const auto &rawFavorites = _settings.getFavoritedProfiles();
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

    // Older firmware never enforced the limit; cap here instead of rewriting the stored favorites.
    if (result.size() > MAX_FAVORITED_PROFILES)
        result.resize(MAX_FAVORITED_PROFILES);
    if (result.empty()) {
        String sel = _settings.getSelectedProfile();
        bool selValid = (!validate) || profileExists(sel);
        if (selValid) {
            result.push_back(sel);
        }
    }
    return result;
}

void ProfileManager::removeFavoritedProfile(String id) {
    _settings.removeFavoritedProfile(id);
    _plugin_manager->trigger("profiles:profile:unfavorite", "id", id);
}

bool ProfileManager::addFavoritedProfile(String id) {
    const auto &favorites = _settings.getFavoritedProfiles();
    if (std::find(favorites.begin(), favorites.end(), id) != favorites.end())
        return true;
    if (favorites.size() >= MAX_FAVORITED_PROFILES)
        return false;
    _settings.addFavoritedProfile(id);
    _plugin_manager->trigger("profiles:profile:favorite", "id", id);
    return true;
}
