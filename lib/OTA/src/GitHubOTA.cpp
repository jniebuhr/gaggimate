#include "GitHubOTA.h"
#include "EspHttpTransport.h"
#include "ResumableDownloader.h"
#include "common.h"
#include "semver_extensions.h"
#include <esp_ota_ops.h>

GitHubOTA::GitHubOTA(const String &display_version, const String &controller_version, const String &release_url,
                     const phase_callback_t &phase_callback, const progress_callback_t &progress_callback,
                     const String &firmware_name, const String &filesystem_name, const String &controller_firmware_name) {
    _version = from_string(display_version.substring(1).c_str());
    _controller_version = from_string(controller_version.substring(1).c_str());

    _release_url = release_url;
    _firmware_name = firmware_name;
    _filesystem_name = filesystem_name;
    _controller_firmware_name = controller_firmware_name;
    _phase_callback = phase_callback;
    _progress_callback = progress_callback;

    _wifi_client.setCACertBundle(x509_crt_imported_bundle_bin_start);
}

void GitHubOTA::init() {
    _controller_ota.init([this](int progress) { _progress_callback(PHASE_CONTROLLER_FW, progress); });
}

void GitHubOTA::checkForUpdates() {
    const char *TAG = "checkForUpdates";

    _latest_url = get_updated_base_url_via_redirect(_wifi_client, _release_url);
    if (_latest_url != "") {
        ESP_LOGI(TAG, "base_url %s\n", _latest_url.c_str());

        auto last_slash = _latest_url.lastIndexOf('/', _latest_url.length() - 2);
        auto semver_str = _latest_url.substring(last_slash + 1);
        semver_str.replace("/", "");
        if (semver_str.substring(0, 1) != "v") {
            ESP_LOGW(TAG, "not a valid version URL");
            return;
        }
        semver_str = semver_str.substring(1);
        ESP_LOGI(TAG, "semver_str %s\n", semver_str.c_str());
        _latest_version_string = semver_str;
        semver_free(&_latest_version);
        _latest_version = from_string(semver_str.c_str());
        _screen_update_required = update_required(_latest_version, _version);
        _controller_update_required = update_required(_latest_version, _controller_version);
    } else {
        _latest_url = _release_url + "/";
        _latest_url.replace("tag", "download");
        String version = get_updated_version_via_txt_file(_wifi_client, _latest_url);

        if (version.length() == 0) {
            ESP_LOGW(TAG, "version.txt did not return a valid version string");
            return;
        }

        version = version.substring(1);
        _latest_version_string = version;
        semver_free(&_latest_version);
        _latest_version = from_string(version.c_str());
        _screen_update_required = update_required(_latest_version, _version);
        _controller_update_required = update_required(_latest_version, _controller_version);
    }
}

String GitHubOTA::getCurrentVersion() const { return _latest_version_string; }

bool GitHubOTA::isUpdateAvailable(bool controller) const {
    if (controller) {
        return _controller_update_required;
    }
    return _screen_update_required;
}

void GitHubOTA::setPhase(uint8_t newPhase) {
    phase = newPhase;
    _phase_callback(newPhase);
}

void GitHubOTA::update(bool controller, bool display, NimBLEClient *client) {
    const char *TAG = "update";

    bool updateExecuted = false;

    // checkForUpdates() stores a server-provided Location; never let a downgraded redirect reach the downloads.
    if (!_latest_url.startsWith("https://")) {
        ESP_LOGE(TAG, "Refusing non-HTTPS release URL: %s", _latest_url.c_str());
        setPhase(PHASE_FAILED);
        return;
    }

    if (controller && update_required(_latest_version, _controller_version)) {
        ESP_LOGI(TAG, "Controller update is required, running firmware update.");
        setPhase(PHASE_CONTROLLER_FW);
        if (!_controller_ota.update(client, _latest_url + _controller_firmware_name)) {
            ESP_LOGE(TAG, "Controller update failed");
            setPhase(PHASE_FAILED);
            return;
        }
        ESP_LOGI(TAG, "Controller update successful.");
        updateExecuted = true;
    }

    if (display && update_required(_latest_version, _version)) {
        ESP_LOGI(TAG, "Update is required, running firmware update.");
        setPhase(PHASE_DISPLAY_FW);
        if (!flashDisplayFirmware(_latest_url + _firmware_name)) {
            ESP_LOGE(TAG, "Display update failed");
            setPhase(PHASE_FAILED);
            return;
        }
        // The web UI ships inside the app image (GM-106); LittleFS (profiles + shots) is never touched by OTA.
        ESP_LOGI(TAG, "Update successful. Restarting...\n");
        updateExecuted = true;
    }
    setPhase(PHASE_FINISHED);

    if (updateExecuted) {
        delay(1000);
        ESP.restart();
    }

    ESP_LOGI(TAG, "No updates found\n");
}

void GitHubOTA::setReleaseUrl(const String &release_url) { this->_release_url = release_url; }

bool GitHubOTA::flashDisplayFirmware(const String &url) {
    const char *TAG = "flashDisplayFirmware";
    ESP_LOGI(TAG, "Download URL: %s", url.c_str());

    const esp_partition_t *partition = esp_ota_get_next_update_partition(nullptr);
    if (partition == nullptr) {
        ESP_LOGE(TAG, "No OTA partition available");
        return false;
    }
    esp_ota_handle_t handle = 0;
    auto begin = [&]() {
        // Sequential-write mode erases sectors as data arrives, so a resumed stream continues where it left off.
        esp_err_t err = esp_ota_begin(partition, OTA_WITH_SEQUENTIAL_WRITES, &handle);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "esp_ota_begin failed: %s", esp_err_to_name(err));
            handle = 0;
        }
        return err == ESP_OK;
    };
    if (!begin()) {
        return false;
    }

    DownloadSink sink;
    sink.write = [&](const uint8_t *data, size_t len) {
        esp_err_t err = esp_ota_write(handle, data, len);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "esp_ota_write failed: %s", esp_err_to_name(err));
        }
        return err == ESP_OK;
    };
    sink.restart = [&]() {
        esp_ota_abort(handle);
        return begin();
    };
    EspHttpTransport transport;
    EspDownloadEnv env;
    ResumableDownloader downloader(transport, env, url.c_str(), sink, [this](size_t received, size_t total) {
        if (total > 0 || received == 0) {
            _progress_callback(phase, total > 0 ? static_cast<int>((static_cast<uint64_t>(received) * 100) / total) : 0);
        }
    });
    if (!downloader.run() || downloader.received() == 0) {
        esp_ota_abort(handle);
        return false;
    }

    // esp_ota_end verifies the complete image (header, checksum, appended SHA-256) before it can be booted.
    esp_err_t err = esp_ota_end(handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Image verification failed: %s", esp_err_to_name(err));
        return false;
    }
    err = esp_ota_set_boot_partition(partition);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_set_boot_partition failed: %s", esp_err_to_name(err));
        return false;
    }
    ESP_LOGI(TAG, "Wrote %u bytes to %s", static_cast<unsigned>(downloader.received()), partition->label);
    return true;
}

void GitHubOTA::setControllerVersion(const String &controller_version) {
    semver_free(&_controller_version);
    _controller_version = from_string(controller_version.substring(1).c_str());
    _controller_update_required = update_required(_latest_version, _controller_version);
}
