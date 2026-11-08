// Host shim for esp_core_dump.h: no core dumps in the simulator.
#pragma once

#include "esp_err.h"
#include <stddef.h>

static inline esp_err_t esp_core_dump_image_get(size_t *out_addr, size_t *out_size) {
    (void)out_addr;
    (void)out_size;
    return ESP_FAIL;
}
