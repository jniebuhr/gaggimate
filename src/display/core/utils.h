#pragma once
#ifndef UTILS_H
#define UTILS_H
#include <Arduino.h>
#include <functional>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

template <typename T, typename... Args> std::unique_ptr<T> make_unique(Args &&...args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

template <typename... Args> std::string string_format(const std::string &format, Args... args) {
    int size_s = std::snprintf(nullptr, 0, format.c_str(), args...) + 1; // Extra space for '\0'
    if (size_s <= 0) {
        throw std::runtime_error("Error during formatting.");
    }
    auto size = static_cast<size_t>(size_s);
    std::unique_ptr<char[]> buf(new char[size]);
    std::snprintf(buf.get(), size, format.c_str(), args...);
    return std::string(buf.get(), buf.get() + size - 1); // We don't want the '\0' inside
}

extern uint8_t randomByte();
extern String generateShortID(uint8_t length = 10);
extern std::vector<String> explode(const String &input, char delim);
extern String implode(const std::vector<String> &strings, String delim);
// Runtime heap observability (60 s sampler, onFailedAlloc, panic hook) lives
// in src/display/core/MemoryMonitor.* and is always compiled.
//
// The helpers below are debug-only boot/trace profilers, compiled to no-ops
// unless the build defines -DGAGGIMATE_HEAP_PROFILE=1 (see platformio.ini).
extern void measure_heap(const String &label, std::function<void()> callback);
extern bool is_task_healthy(const eTaskState task_state);

// Per-subsystem heap checkpoint. Logs current internal + PSRAM free/largest/
// fragmentation, plus delta since the previous call. No-op unless
// GAGGIMATE_HEAP_PROFILE=1.
extern void heap_checkpoint(const char *label);

// Reset the heap_checkpoint() baseline. No-op unless GAGGIMATE_HEAP_PROFILE=1.
extern void heap_checkpoint_reset();

// Heavyweight dump of heap_caps_print_heap_info() for both regions. No-op
// unless GAGGIMATE_HEAP_PROFILE=1.
extern void heap_dump(const char *label);

#endif // UTILS_H
