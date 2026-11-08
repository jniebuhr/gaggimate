#pragma once
#ifndef PROFILEMANAGER_H
#define PROFILEMANAGER_H
#include "PluginManager.h"
#include <FS.h>
#include <display/core/Settings.h>
#include <display/core/utils.h>
#include <display/models/profile.h>

// System profiles are seeded when missing, stay editable, live under utility and cannot be deleted.
constexpr const char *BACKFLUSH_PROFILE_ID = "flush";
constexpr const char *DESCALING_PROFILE_ID = "descale";

constexpr size_t MAX_FAVORITED_PROFILES = 10; // the web UI enforces the same limit

class ProfileManager {
  public:
    static bool isSystemProfile(const String &uuid);

    ProfileManager(fs::FS *fs, String dir, Settings &settings, PluginManager *plugin_manager);

    void setup();
    std::vector<String> listProfiles();
    bool loadProfile(const String &uuid, Profile &outProfile);
    bool saveProfile(Profile &profile);
    bool deleteProfile(const String &uuid);
    bool profileExists(const String &uuid);
    bool hasProfileImage(const String &uuid);
    // Ids of all profiles with an image, from one directory scan instead of a probe per profile.
    std::vector<String> listProfileImages();
    // Reads and validates a profile image; returns its RGB565 pixels in PSRAM (caller frees) or nullptr.
    uint8_t *loadProfileImage(const String &uuid);
    void selectProfile(const String &uuid);
    Profile &getSelectedProfile();
    bool loadSelectedProfile(Profile &outProfile);
    std::vector<String> getFavoritedProfiles(bool validate = false);

    bool addFavoritedProfile(String id); // false once MAX_FAVORITED_PROFILES are favorited
    void removeFavoritedProfile(String id);

  private:
    Profile selectedProfile{};
    PluginManager *_plugin_manager;
    Settings &_settings;
    fs::FS *_fs;
    String _dir;
    bool ensureDirectory() const;
    String profilePath(const String &uuid) const;
    void migrate(const std::vector<String> &existingProfiles);
    void ensureSystemProfiles();
};

#endif // PROFILEMANAGER_H
