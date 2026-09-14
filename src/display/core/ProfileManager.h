#pragma once
#ifndef PROFILEMANAGER_H
#define PROFILEMANAGER_H
#include "PluginManager.h"
#include <FS.h>
#include <display/core/Settings.h>
#include <display/core/utils.h>
#include <display/models/profile.h>

class ProfileManager {
  public:
    ProfileManager(fs::FS *fs, String dir, Settings &settings, PluginManager *plugin_manager);

    void setup();
    std::vector<String> listProfiles();
    bool loadProfile(const String &uuid, Profile &outProfile);
    bool saveProfile(Profile &profile);
    bool deleteProfile(const String &uuid);
    bool profileExists(const String &uuid);
    void selectProfile(const String &uuid);
    Profile &getSelectedProfile();
    bool loadSelectedProfile(Profile &outProfile);
    std::vector<String> getFavoritedProfiles(bool validate = false);

    void addFavoritedProfile(String id);
    void removeFavoritedProfile(String id);
    void reorderProfiles(const std::vector<String> &order);

    // Monotonic counter bumped by every change that alters what a profile list
    // request would return (file contents, selection, favorites, order). Sent to
    // web clients so they can keep a cached list and skip the request entirely
    // while the revision they hold is still current.
    uint32_t getRevision() const { return revision; }

  private:
    Profile selectedProfile{};
    uint32_t revision = 1;
    void bumpRevision() { revision++; }
    PluginManager *_plugin_manager;
    Settings &_settings;
    fs::FS *_fs;
    String _dir;
    bool ensureDirectory() const;
    String profilePath(const String &uuid) const;
    void migrate(const std::vector<String> &existingProfiles);
};

#endif // PROFILEMANAGER_H
