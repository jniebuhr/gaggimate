#pragma once
#ifndef PROFILEMANAGER_H
#define PROFILEMANAGER_H
#include "PluginManager.h"
#include <FS.h>
#include <display/core/Settings.h>
#include <display/core/utils.h>
#include <display/models/profile.h>
#include <display/util/PsramStlAllocator.h>
#include <map>
#include <mutex>
#include <string>

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

    // Complete "profiles" array of req:profiles:list, pre-serialized and cached
    // in PSRAM. Rebuilt lazily after a revision change; empty pointer on failure.
    using PsramString = std::basic_string<char, std::char_traits<char>, PsramStlAllocator<char>>;
    const PsramString *getListJson(bool minimal);

  private:
    Profile selectedProfile{};
    // Parsed-from-flash cost dominated the profile list request (open + read +
    // deserialize every profile on every call, from the async_tcp task). Raw
    // file contents are cached in PSRAM, keyed by id, so repeat loads never
    // touch the filesystem; entries drop on save/delete. The directory listing
    // is cached the same way. See getListJson for the list response itself.
    std::recursive_mutex cacheMutex;
    std::map<String, PsramString> fileCache;
    std::vector<String> idCache;
    bool idCacheValid = false;
    PsramString listJsonFull;
    PsramString listJsonMinimal;
    uint32_t listJsonRevision[2] = {UINT32_MAX, UINT32_MAX};
    uint32_t revision = 1;

    void bumpRevision();
    void invalidateFile(const String &uuid);
    bool readProfileFile(const String &uuid, PsramString &out);
    PluginManager *_plugin_manager;
    Settings &_settings;
    fs::FS *_fs;
    String _dir;
    bool ensureDirectory() const;
    String profilePath(const String &uuid) const;
    void migrate(const std::vector<String> &existingProfiles);
};

#endif // PROFILEMANAGER_H
