// Host shim for esp32-hal-psram.h: PSRAM allocators fall back to the heap.
#pragma once

#include <stdbool.h>
#include <stdlib.h>

static inline void *ps_malloc(size_t size) { return malloc(size); }
static inline void *ps_calloc(size_t n, size_t size) { return calloc(n, size); }
static inline void *ps_realloc(void *ptr, size_t size) { return realloc(ptr, size); }
static inline bool psramInit(void) { return true; }
static inline bool psramFound(void) { return true; }
