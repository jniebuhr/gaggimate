#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Update.h>
#include <WiFiClientSecure.h>

#include "GitHubOTA.h"
#include "common.h"
#include "semver_extensions.h"
#include <ArduinoJson.h>

GitHubOTA::GitHubOTA(const String &version, const String &release_url, const phase_callback_t &phase_callback,
                     const progress_callback_t &progress_callback, const String &firmware_name, const String &filesystem_name) {
    ESP_LOGV("GitHubOTA", "GitHubOTA(version: %s, firmware_name: %s, fetch_url_via_redirect: %d)\n", version.c_str(),
             firmware_name.c_str(), fetch_url_via_redirect);

    _version = from_string(version.substring(1).c_str());
    _release_url = release_url;
    _firmware_name = firmware_name;
    _filesystem_name = filesystem_name;
    _phase_callback = phase_callback;

    Updater.rebootOnUpdate(false);
    _wifi_client.setCACertBundle(x509_crt_imported_bundle_bin_start);

    Updater.onStart(update_started);
    Updater.onEnd(update_finished);
    Updater.onProgress([progress_callback](int bytesReceived, int totalBytes) {
        int percentage = 100.0 * bytesReceived / totalBytes;
        progress_callback(percentage);
        ESP_LOGI("update_progress", "Data received, Progress: %d %%\r", percentage);
    });
    Updater.onError(update_error);
    Updater.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
}

void GitHubOTA::checkForUpdates() {
    const char *TAG = "checkForUpdates";

    _latest_url = get_updated_base_url_via_redirect(_wifi_client, _release_url);
    ESP_LOGI(TAG, "base_url %s\n", _latest_url.c_str());

    auto last_slash = _latest_url.lastIndexOf('/', _latest_url.length() - 2);
    auto semver_str = _latest_url.substring(last_slash + 2);
    semver_str.replace("/", "");
    ESP_LOGI(TAG, "semver_str %s\n", semver_str.c_str());
    _latest_version = from_string(semver_str.c_str());
}

String GitHubOTA::getCurrentVersion() const {
    return String(_latest_version.major) + "." + String(_latest_version.minor) + "." + _latest_version.patch;
}

bool GitHubOTA::isUpdateAvailable() const { return update_required(_latest_version, _version); }

void GitHubOTA::update() {
    const char *TAG = "update";

    if (update_required(_latest_version, _version)) {
        ESP_LOGI(TAG, "Update is required, running firmware update.");
        this->_phase_callback(PHASE_DISPLAY_FW);
        auto result = update_firmware(_latest_url + _firmware_name);

        if (result != HTTP_UPDATE_OK) {
            ESP_LOGI(TAG, "Update failed: %s\n", Updater.getLastErrorString().c_str());
            return;
        }

        this->_phase_callback(PHASE_DISPLAY_FS);
        result = update_filesystem(_latest_url + _filesystem_name);

        if (result != HTTP_UPDATE_OK) {
            ESP_LOGI(TAG, "Filesystem Update failed: %s\n", Updater.getLastErrorString().c_str());
            return;
        }

        ESP_LOGI(TAG, "Update successful. Restarting...\n");
        delay(1000);
        ESP.restart();
    }

    ESP_LOGI(TAG, "No updates found\n");
}

void GitHubOTA::setReleaseUrl(const String &release_url) { this->_release_url = release_url; }

HTTPUpdateResult GitHubOTA::update_firmware(const String &url) {
    const char *TAG = "update_firmware";
    ESP_LOGI(TAG, "Download URL: %s\n", url.c_str());

    auto result = Updater.update(_wifi_client, url);

    print_update_result(Updater, result, TAG);
    return result;
}

HTTPUpdateResult GitHubOTA::update_filesystem(const String &url) {
    const char *TAG = "update_filesystem";
    ESP_LOGI(TAG, "Download URL: %s\n", url.c_str());

    auto result = Updater.updateSpiffs(_wifi_client, url);
    print_update_result(Updater, result, TAG);
    return result;
}
