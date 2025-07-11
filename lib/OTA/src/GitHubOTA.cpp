#include "GitHubOTA.h"
#include "common.h"
#include "semver_extensions.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Update.h>
#include <WiFiClientSecure.h>

GitHubOTA::GitHubOTA(const String &display_version, const String &controller_version, const String &release_url,
                     const phase_callback_t &phase_callback, const progress_callback_t &progress_callback,
                     const String &firmware_name, const String &filesystem_name, const String &controller_firmware_name) {
    ESP_LOGV("GitHubOTA", "GitHubOTA(version: %s, firmware_name: %s, fetch_url_via_redirect: %d)\n", version.c_str(),
             firmware_name.c_str(), fetch_url_via_redirect);

    _version = from_string(display_version.substring(1).c_str());
    _controller_version = from_string(controller_version.substring(1).c_str());
    _release_url = release_url;
    _firmware_name = firmware_name;
    _filesystem_name = filesystem_name;
    _controller_firmware_name = controller_firmware_name;
    _phase_callback = phase_callback;
    _progress_callback = progress_callback;

    Updater.rebootOnUpdate(false);
    _wifi_client.setCACertBundle(x509_crt_imported_bundle_bin_start);

    Updater.onStart(update_started);
    Updater.onEnd(update_finished);
    Updater.onProgress([progress_callback, this](int bytesReceived, int totalBytes) {
        int percentage = 100.0 * bytesReceived / totalBytes;
        progress_callback(phase, percentage);
        ESP_LOGV("update_progress", "Data received, Progress: %d %%\r", percentage);
    });
    Updater.onError(update_error);
    Updater.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
}

void GitHubOTA::init(NimBLEClient *client) {
    _controller_ota.init(client, [this](int progress) { _progress_callback(PHASE_CONTROLLER_FW, progress); });
}

void GitHubOTA::checkForUpdates() {
    const char *TAG = "checkForUpdates";

    _latest_url = get_updated_base_url_via_redirect(_wifi_client, _release_url);
    if (_latest_url != "") {
        ESP_LOGI(TAG, "base_url %s\n", _latest_url.c_str());

        auto last_slash = _latest_url.lastIndexOf('/', _latest_url.length() - 2);
        auto semver_str = _latest_url.substring(last_slash + 2);
        semver_str.replace("/", "");
        ESP_LOGI(TAG, "semver_str %s\n", semver_str.c_str());
        _latest_version_string = semver_str;
        _latest_version = from_string(semver_str.c_str());
    } else {
        _latest_url = _release_url + "/";
        _latest_url.replace("tag", "download");
        String version = get_updated_version_via_txt_file(_wifi_client, _latest_url);
        version = version.substring(1);
        _latest_version_string = version;
        _latest_version = from_string(version.c_str());
    }
}

String GitHubOTA::getCurrentVersion() const { return _latest_version_string; }

bool GitHubOTA::isUpdateAvailable(bool controller) const {
    if (controller) {
        return update_required(_latest_version, _controller_version);
    }
    return update_required(_latest_version, _version);
}

void GitHubOTA::update(bool controller, bool display) {
    const char *TAG = "update";

    if (controller && update_required(_latest_version, _controller_version)) {
        ESP_LOGI(TAG, "Controller update is required, running firmware update.");
        this->phase = PHASE_CONTROLLER_FW;
        this->_phase_callback(PHASE_CONTROLLER_FW);
        _controller_ota.update(_wifi_client, _latest_url + _controller_firmware_name);
        ESP_LOGI(TAG, "Controller update successful. Restarting...\n");
    }

    if (display && update_required(_latest_version, _version)) {
        ESP_LOGI(TAG, "Update is required, running firmware update.");
        this->phase = PHASE_DISPLAY_FW;
        this->_phase_callback(PHASE_DISPLAY_FW);
        auto result = update_firmware(_latest_url + _firmware_name);

        if (result != HTTP_UPDATE_OK) {
            ESP_LOGI(TAG, "Update failed: %s\n", Updater.getLastErrorString().c_str());
            return;
        }

        this->phase = PHASE_DISPLAY_FS;
        this->_phase_callback(PHASE_DISPLAY_FS);
        result = update_filesystem(_latest_url + _filesystem_name);

        if (result != HTTP_UPDATE_OK) {
            ESP_LOGI(TAG, "Filesystem Update failed: %s\n", Updater.getLastErrorString().c_str());
            return;
        }

        ESP_LOGI(TAG, "Update successful. Restarting...\n");
        this->phase = PHASE_FINISHED;
        this->_phase_callback(PHASE_FINISHED);
        delay(1000);
        ESP.restart();
    }
    this->phase = PHASE_FINISHED;
    this->_phase_callback(PHASE_FINISHED);

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

void GitHubOTA::setControllerVersion(const String &controller_version) {
    _controller_version = from_string(controller_version.substring(1).c_str());
}
