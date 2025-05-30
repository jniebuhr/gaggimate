#pragma once
#ifndef PROFILEMANAGER_H
#define PROFILEMANAGER_H
#include <FS.h>
#include <display/core/Settings.h>
#include <display/models/profile.h>
#include <vector>

class ProfileManager {
  public:
    ProfileManager(fs::FS &fs, const char *dir, Settings &settings);

    void setup();
    std::vector<String> listProfiles();
    bool loadProfile(const String &uuid, Profile &outProfile);
    bool saveProfile(Profile &profile);
    bool deleteProfile(const String &uuid);
    bool profileExists(const String &uuid);
    void selectProfile(const String &uuid) const;
    String getSelectedProfile() const;
    void loadSelectedProfile(Profile &outProfile);

  private:
    Settings &_settings;
    fs::FS &_fs;
    String _dir;
    bool ensureDirectory();
    String profilePath(const String &uuid);
    void migrate();
};

#endif // PROFILEMANAGER_H
