#pragma once
#include <cstddef>
#include <cstdint>
using TaskHandle_t = void *; // NOSONAR: exact opaque handle shape required by the FreeRTOS API stub.
constexpr int pdPASS = 1;
constexpr int pdTRUE = 1;
constexpr uint32_t portMAX_DELAY = 0xffffffff;
inline int xTaskCreate(void (*)(void *), const char *, uint32_t, void *, int, TaskHandle_t *) { // NOSONAR
    return pdPASS;
}
inline void vTaskDelete(TaskHandle_t) { /* Native tests drive tasks explicitly. */ }
