#ifndef PSRAMWSBUFFER_H
#define PSRAMWSBUFFER_H

#include <ESPAsyncWebServer.h>
#include <esp_heap_caps.h>

// Host simulator has no sdkconfig; value matches the arduino-esp32 default.
#ifndef CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL
#define CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL 4096
#endif

// AsyncWebSocket queues every outgoing message as a
// std::shared_ptr<std::vector<uint8_t>> with no allocator hook, so
// makeBuffer() lands any payload below CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL
// (4 KB) on the scarce internal heap — the 500 ms status broadcast alone
// churns it into fragmentation [GM-139]. Dropping the malloc-to-PSRAM
// threshold just while the payload vector is constructed routes it to PSRAM
// instead, with the heap allocator's built-in fallback to internal heap if
// PSRAM is exhausted. The window is a few µs; a concurrent malloc on another
// task at that moment merely lands in PSRAM too, which is harmless.
inline AsyncWebSocketSharedBuffer makePsramWsBuffer(size_t size) {
    heap_caps_malloc_extmem_enable(64);
    auto buffer = std::make_shared<std::vector<uint8_t>>(size);
    heap_caps_malloc_extmem_enable(CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL);
    return buffer;
}

#endif // PSRAMWSBUFFER_H
