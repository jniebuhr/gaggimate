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
    void selectProfile(const String &uuid);
    Profile &getSelectedProfile();
    bool loadSelectedProfile(Profile &outProfile);
    std::vector<String> getFavoritedProfiles(bool validate = false);

    void addFavoritedProfile(String id);
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
