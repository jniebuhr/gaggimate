// Host shim for esp_coexist.h (Wi-Fi/BT coexistence): no-op.
#pragma once

#include "esp_err.h"

typedef enum { ESP_COEX_PREFER_WIFI = 0, ESP_COEX_PREFER_BT, ESP_COEX_PREFER_BALANCE } esp_coex_prefer_t;

static inline esp_err_t esp_coex_preference_set(esp_coex_prefer_t prefer) {
    (void)prefer;
    return ESP_OK;
}
