// Host shim for esp_system.h.
#pragma once

#include "esp_err.h"
#include <stdint.h>
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

static inline uint32_t esp_random(void) { return ((uint32_t)rand() << 16) ^ (uint32_t)rand(); }
static inline uint32_t esp_get_free_heap_size(void) { return 4u * 1024u * 1024u; }
static inline uint32_t esp_get_minimum_free_heap_size(void) { return 2u * 1024u * 1024u; }
static inline void esp_restart(void) { exit(0); }

#ifdef __cplusplus
}
#endif
