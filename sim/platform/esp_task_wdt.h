// Host shim for esp_task_wdt.h: no watchdog in the simulator.
#pragma once

#include "esp_err.h"

static inline esp_err_t esp_task_wdt_add(void *handle) {
    (void)handle;
    return ESP_OK;
}
static inline esp_err_t esp_task_wdt_reset(void) { return ESP_OK; }
static inline esp_err_t esp_task_wdt_delete(void *handle) {
    (void)handle;
    return ESP_OK;
}
