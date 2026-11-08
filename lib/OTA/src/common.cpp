#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "common.h"
#include "semver.h"
#include "semver_extensions.h"
#include <ArduinoJson.h>

String get_updated_base_url_via_redirect(WiFiClientSecure &wifi_client, String &release_url) {
    const char *TAG = "get_updated_base_url_via_redirect";

    String location = get_redirect_location(wifi_client, release_url);
    ESP_LOGV(TAG, "location: %s\n", location.c_str());

    if (location.length() <= 0) {
        ESP_LOGE(TAG, "[HTTPS] No redirect url\n");
        return "";
    }

    String base_url = "";
    base_url = location + "/";
    base_url.replace("tag", "download");

    ESP_LOGV(TAG, "returns: %s\n", base_url.c_str());
    return base_url;
}

String get_redirect_location(WiFiClientSecure &wifi_client, String &initial_url) {
    const char *TAG = "get_redirect_location";
    ESP_LOGV(TAG, "initial_url: %s\n", initial_url.c_str());

    HTTPClient https;
    https.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);

    if (!https.begin(wifi_client, initial_url)) {
        ESP_LOGE(TAG, "[HTTPS] Unable to connect\n");
        return "";
    }

    int httpCode = https.GET();
    if (httpCode != HTTP_CODE_FOUND) {
        ESP_LOGE(TAG, "[HTTPS] GET... failed, No redirect\n");
        char errorText[128];
        int errCode = wifi_client.lastError(errorText, sizeof(errorText));
        ESP_LOGV(TAG, "httpCode: %d, errorCode %d: %s\n", httpCode, errCode, errorText);
    }

    String redirect_url = https.getLocation();
    https.end();

    ESP_LOGI(TAG, "returns: %s\n", redirect_url.c_str());
    return redirect_url;
}

String get_updated_version_via_txt_file(WiFiClientSecure &wifi_client, String &_release_url) {
    const char *TAG = "get_updated_version_via_txt_file";
    HTTPClient https;
    https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    String url = _release_url + "version.txt";
    ESP_LOGI(TAG, "url: %s\n", url.c_str());
    if (!https.begin(wifi_client, url)) {
        ESP_LOGE(TAG, "[HTTPS] Unable to connect\n");
        return "";
    }

    int httpCode = https.GET();
    if (httpCode != HTTP_CODE_OK) {
        ESP_LOGE(TAG, "[HTTPS] GET... failed\n");
        char errorText[128];
        int errCode = wifi_client.lastError(errorText, sizeof(errorText));
        ESP_LOGV(TAG, "httpCode: %d, errorCode %d: %s\n", httpCode, errCode, errorText);
        https.end();
        return "";
    }
    String version = https.getString();
    version.trim();
    https.end();
    ESP_LOGI(TAG, "returns: %s\n", version.c_str());
    return version;
}

bool update_required(semver_t _new_version, semver_t _current_version) {
    ESP_LOGI("update_required", "Comparing versions %s > %s", render_to_string(_new_version).c_str(),
             render_to_string(_current_version).c_str());
    return _new_version > _current_version;
}
