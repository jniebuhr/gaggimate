#ifndef PSRAMALLOCATOR_H
#define PSRAMALLOCATOR_H

#include <ArduinoJson.h>

// Allocator that backs ArduinoJson with PSRAM when available, falling back to
// internal heap if PSRAM is full or unavailable. The profile-list response
// (~20-60 KB for many profiles) used to allocate its node pool from internal
// heap, contributing significantly to the 33%+ heap fragmentation the device
// reports. ESP32-S3 boards in this project have 8 MB PSRAM that is otherwise
// almost idle.
struct PsramAllocator : ArduinoJson::Allocator {
    void *allocate(size_t size) override {
        void *p = heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!p)
            p = heap_caps_malloc(size, MALLOC_CAP_DEFAULT);
        return p;
    }
    void deallocate(void *pointer) override { heap_caps_free(pointer); }
    void *reallocate(void *ptr, size_t new_size) override {
        void *p = heap_caps_realloc(ptr, new_size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!p)
            p = heap_caps_realloc(ptr, new_size, MALLOC_CAP_DEFAULT);
        return p;
    }
};

static PsramAllocator psramAllocator;

#endif // PSRAMALLOCATOR_H
