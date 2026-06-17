// Host shim for GitHubOTA: firmware OTA is unavailable in the simulator.
#pragma once

#include "WString.h"
#include <cstdint>
#include <functional>

class NimBLEClient;

using phase_callback_t = std::function<void(uint8_t phase)>;
using progress_callback_t = std::function<void(uint8_t phase, int progress)>;

class GitHubOTA {
  public:
    GitHubOTA(const String &display_version, const String &controller_version, const String &release_url,
              phase_callback_t = nullptr, progress_callback_t = nullptr, const String & = "firmware.bin",
              const String & = "filesystem.bin", const String & = "controller.bin")
        : _version(display_version) {}

    void init(NimBLEClient *) {}
    void checkForUpdates() {}
    bool isUpdateAvailable(bool = false) const { return false; }
    String getCurrentVersion() const { return _version; }
    void update(bool = true, bool = true) {}
    void setReleaseUrl(const String &) {}
    void setControllerVersion(const String &) {}

  private:
    String _version;
};
