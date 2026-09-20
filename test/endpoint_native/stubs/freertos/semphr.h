#pragma once
#include <memory>
#include <mutex>
using SemaphoreHandle_t = std::shared_ptr<std::mutex>;
inline SemaphoreHandle_t xSemaphoreCreateMutex() { return std::make_shared<std::mutex>(); }
inline int xSemaphoreTake(const SemaphoreHandle_t &mutex, uint32_t) { // NOSONAR: mirrors the FreeRTOS semaphore C API.
    mutex->lock();
    return 1;
}
inline int xSemaphoreGive(const SemaphoreHandle_t &mutex) { // NOSONAR: paired by Endpoint's lock/unlock boundary.
    mutex->unlock();
    return 1;
}
inline void vSemaphoreDelete(SemaphoreHandle_t &mutex) { mutex.reset(); }
