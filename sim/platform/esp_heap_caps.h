// Host shim for esp_heap_caps.h: heap-cap allocs map onto the libc heap.
#pragma once

#include <stdint.h>
#include <stdlib.h>

#define MALLOC_CAP_8BIT 0
#define MALLOC_CAP_32BIT 0
#define MALLOC_CAP_DMA 0
#define MALLOC_CAP_SPIRAM 0
#define MALLOC_CAP_INTERNAL 0
#define MALLOC_CAP_DEFAULT 0

static inline void *heap_caps_malloc(size_t size, uint32_t caps) {
    (void)caps;
    return malloc(size);
}
static inline void *heap_caps_calloc(size_t n, size_t size, uint32_t caps) {
    (void)caps;
    return calloc(n, size);
}
static inline void *heap_caps_realloc(void *ptr, size_t size, uint32_t caps) {
    (void)caps;
    return realloc(ptr, size);
}
static inline void heap_caps_free(void *ptr) { free(ptr); }
// Report a generous, fixed budget so memory-watching UI code stays happy.
static inline size_t heap_caps_get_free_size(uint32_t caps) {
    (void)caps;
    return 4u * 1024u * 1024u;
}
static inline size_t heap_caps_get_total_size(uint32_t caps) {
    (void)caps;
    return 8u * 1024u * 1024u;
}
static inline size_t heap_caps_get_largest_free_block(uint32_t caps) {
    (void)caps;
    return 2u * 1024u * 1024u;
}
