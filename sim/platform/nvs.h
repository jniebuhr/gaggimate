// Host shim for the raw NVS API: blobs go into the Preferences shim's JSON store as text.
#pragma once

#include "Preferences.h"
#include "esp_err.h"
#include <cstdint>
#include <string>

typedef uint32_t nvs_handle_t;
typedef enum { NVS_READONLY, NVS_READWRITE } nvs_open_mode_t;

#define ESP_ERR_NVS_INVALID_HANDLE 0x1107

// One namespace open at a time is enough for the firmware's single blob write.
inline std::string &sim_nvs_namespace() {
    static std::string ns;
    return ns;
}

inline esp_err_t nvs_open(const char *name, nvs_open_mode_t, nvs_handle_t *out) {
    sim_nvs_namespace() = name ? name : "";
    *out = 1;
    return ESP_OK;
}

// The firmware only stores NUL-terminated text this way, so the value is kept as a string.
inline esp_err_t nvs_set_blob(nvs_handle_t handle, const char *key, const void *value, size_t length) {
    if (handle != 1)
        return ESP_ERR_NVS_INVALID_HANDLE;
    Preferences prefs;
    prefs.begin(sim_nvs_namespace().c_str(), false);
    const char *text = static_cast<const char *>(value);
    prefs.putString(key, String(std::string(text, length && text[length - 1] == '\0' ? length - 1 : length).c_str()));
    prefs.end();
    return ESP_OK;
}

inline esp_err_t nvs_commit(nvs_handle_t) { return ESP_OK; }
inline void nvs_close(nvs_handle_t) {}
