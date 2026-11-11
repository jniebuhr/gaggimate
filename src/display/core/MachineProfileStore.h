#pragma once
#include <ArduinoJson.h>
#include <FS.h>
#include <mutex>

// Same filesystem as brew profiles; applied settings remain independent in NVS.
class MachineProfileStore {
  public:
    explicit MachineProfileStore(fs::FS &fs) : fs(fs) {}
    bool list(JsonArray result, String &error);
    bool load(const String &id, JsonDocument &profile, String &error);
    bool save(JsonVariantConst profile, String &error, bool replace = false);
    bool remove(const String &id, String &error);
    static bool validId(const String &id);

  private:
    fs::FS &fs;
    std::mutex mutex;
    bool ensureDirectory(String &error);
    bool loadUnlocked(const String &id, JsonDocument &profile, String &error);
    bool listUnlocked(JsonArray result, String &error);
};
