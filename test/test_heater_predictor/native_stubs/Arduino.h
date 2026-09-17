#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

extern unsigned long gmTestMillis;

inline unsigned long millis() { return gmTestMillis; }
inline unsigned long micros() { return gmTestMillis * 1000UL; }
inline void pinMode(uint8_t, int) {}
inline void digitalWrite(uint8_t, int) {}

template <typename T> T constrain(T value, T lower, T upper) {
    return std::max(lower, std::min(value, upper));
}

constexpr int OUTPUT = 1;
constexpr int LOW = 0;
constexpr int HIGH = 1;
constexpr float PI = 3.14159265358979323846f;

#ifndef ESP_LOGV
#define ESP_LOGV(...) ((void)0)
#endif
#ifndef ESP_LOGI
#define ESP_LOGI(...) ((void)0)
#endif
#ifndef ESP_LOGW
#define ESP_LOGW(...) ((void)0)
#endif
#ifndef ESP_LOGE
#define ESP_LOGE(...) ((void)0)
#endif
