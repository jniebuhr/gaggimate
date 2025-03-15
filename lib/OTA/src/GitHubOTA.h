#ifndef ESP_GITHUB_OTA_H
#define ESP_GITHUB_OTA_H

#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>

#include "semver.h"

constexpr uint8_t PHASE_DISPLAY_FW = 0;
constexpr uint8_t PHASE_DISPLAY_FS = 1;
constexpr uint8_t PHASE_CONTROLLER_FW = 2;

using phase_callback_t = std::function<void(uint8_t phase)>;
using progress_callback_t = std::function<void(int progress)>;

extern const uint8_t x509_crt_imported_bundle_bin_start[] asm("_binary_x509_crt_bundle_start");

class GitHubOTA {
  public:
    GitHubOTA(const String &version, const String &release_url, const phase_callback_t &phase_callback,
              const progress_callback_t &progress_callback, const String &firmware_name = "firmware.bin",
              const String &filesystem_name = "filesystem.bin");

    void checkForUpdates();
    bool isUpdateAvailable() const;
    String getCurrentVersion() const;
    void update();
    void setReleaseUrl(const String &release_url);

  private:
    HTTPUpdate Updater;

    HTTPUpdateResult update_filesystem(const String &url);
    HTTPUpdateResult update_firmware(const String &url);

    semver_t _version;
    semver_t _latest_version = {0, 0, 0, nullptr, nullptr};
    String _release_url;
    String _latest_url;
    String _firmware_name;
    String _filesystem_name;
    WiFiClientSecure _wifi_client;
    phase_callback_t _phase_callback = nullptr;
};

#endif
