#pragma once
#include <cstddef>
#include <cstdint>
using TaskHandle_t = void *;
constexpr int pdPASS = 1, pdTRUE = 1;
constexpr uint32_t portMAX_DELAY = 0xffffffff;
inline int xTaskCreate(void (*)(void *), const char *, uint32_t, void *, int, TaskHandle_t *) { return pdPASS; }
inline void vTaskDelete(TaskHandle_t) {}
