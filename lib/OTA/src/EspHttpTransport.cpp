#ifdef ESP_PLATFORM
#include "EspHttpTransport.h"
#include "ota_log.h"
#include <cstring>
#include <esp_crt_bundle.h>
#include <esp_heap_caps.h>
#include <esp_wifi.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

static const char *TAG = "EspHttpTransport";

// Arduino replaces the IDF bundle with its own copy; attach only works after the bundle was set.
extern const uint8_t x509_crt_imported_bundle_bin_start[] asm("_binary_x509_crt_bundle_start");

bool EspHttpTransport::begin(const std::string &url) {
    end();
    _url = url;
    arduino_esp_crt_bundle_set(x509_crt_imported_bundle_bin_start);
    esp_http_client_config_t config = {};
    config.url = _url.c_str();
    config.event_handler = onEvent;
    config.user_data = this;
    config.crt_bundle_attach = arduino_esp_crt_bundle_attach;
    config.timeout_ms = _timeoutMs;
    config.buffer_size = 2048;    // rx: header lines, including the ~1.3 KB signed CDN Location
    config.buffer_size_tx = 4096; // tx: the request line carries the signed CDN path after the redirect
    config.user_agent = "GaggiMate-OTA";
    config.disable_auto_redirect = true;
    config.method = HTTP_METHOD_GET;
    _client = esp_http_client_init(&config);
    if (_client == nullptr) {
        OTA_LOGE(TAG, "esp_http_client_init failed");
        return false;
    }
    return true;
}

void EspHttpTransport::setHeader(const char *key, const char *value) {
    if (_client != nullptr) {
        esp_http_client_set_header(_client, key, value);
    }
}

bool EspHttpTransport::open(int &status, int &contentLength) {
    _etag.clear();
    _contentRange.clear();
    esp_err_t err = esp_http_client_open(_client, 0);
    if (err != ESP_OK) {
        OTA_LOGE(TAG, "Connection failed: %s", esp_err_to_name(err));
        return false;
    }
    contentLength = esp_http_client_fetch_headers(_client);
    if (contentLength < 0) {
        OTA_LOGE(TAG, "Reading the response headers failed");
        return false;
    }
    status = esp_http_client_get_status_code(_client);
    return true;
}

bool EspHttpTransport::followRedirect() {
    if (esp_http_client_set_redirection(_client) != ESP_OK) {
        return false;
    }
    esp_http_client_close(_client);
    return true;
}

int EspHttpTransport::read(uint8_t *buffer, size_t len) {
    return esp_http_client_read(_client, reinterpret_cast<char *>(buffer), static_cast<int>(len));
}

bool EspHttpTransport::isComplete() { return esp_http_client_is_complete_data_received(_client); }

std::string EspHttpTransport::header(const char *key) {
    if (strcasecmp(key, "ETag") == 0) {
        return _etag;
    }
    if (strcasecmp(key, "Content-Range") == 0) {
        return _contentRange;
    }
    return "";
}

void EspHttpTransport::end() {
    if (_client == nullptr) {
        return;
    }
    esp_http_client_close(_client);
    esp_http_client_cleanup(_client);
    _client = nullptr;
}

esp_err_t EspHttpTransport::onEvent(esp_http_client_event_t *evt) {
    if (evt->event_id != HTTP_EVENT_ON_HEADER || evt->user_data == nullptr) {
        return ESP_OK;
    }
    auto *self = static_cast<EspHttpTransport *>(evt->user_data);
    if (strcasecmp(evt->header_key, "ETag") == 0) {
        self->_etag = evt->header_value;
    } else if (strcasecmp(evt->header_key, "Content-Range") == 0) {
        self->_contentRange = evt->header_value;
    }
    return ESP_OK;
}

void EspDownloadEnv::delayMs(uint32_t ms) { vTaskDelay(pdMS_TO_TICKS(ms)); }

bool EspDownloadEnv::waitForNetwork(uint32_t maxWaitMs) {
    wifi_mode_t mode = WIFI_MODE_NULL;
    if (esp_wifi_get_mode(&mode) != ESP_OK || (mode != WIFI_MODE_STA && mode != WIFI_MODE_APSTA)) {
        return true;
    }
    wifi_ap_record_t ap;
    uint32_t waited = 0;
    while (esp_wifi_sta_get_ap_info(&ap) != ESP_OK) {
        if (waited >= maxWaitMs) {
            return false;
        }
        vTaskDelay(pdMS_TO_TICKS(500));
        waited += 500;
    }
    if (waited > 0) {
        vTaskDelay(pdMS_TO_TICKS(1000)); // let DHCP finish after a re-association
    }
    return true;
}

uint8_t *EspDownloadEnv::allocBuffer(size_t size) {
    // Flash writes need a DRAM source; PSRAM is unreachable while the cache is disabled.
    return static_cast<uint8_t *>(heap_caps_malloc(size, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
}

void EspDownloadEnv::freeBuffer(uint8_t *buffer) { heap_caps_free(buffer); }

#endif // ESP_PLATFORM
