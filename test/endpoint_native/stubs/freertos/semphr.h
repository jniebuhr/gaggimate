#pragma once
#include <mutex>
using SemaphoreHandle_t = std::recursive_mutex *;
inline auto xSemaphoreCreateRecursiveMutex() { return new std::recursive_mutex; }
inline int xSemaphoreTakeRecursive(SemaphoreHandle_t m, uint32_t) {
    m->lock();
    return 1;
}
inline int xSemaphoreGiveRecursive(SemaphoreHandle_t m) {
    m->unlock();
    return 1;
}
inline void vSemaphoreDelete(SemaphoreHandle_t m) { delete m; }
