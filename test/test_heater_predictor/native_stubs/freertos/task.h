#pragma once

#include "FreeRTOS.h"

using TaskFunction_t = void (*)(void *);
extern unsigned long gmTestMillis;

inline BaseType_t xTaskCreate(TaskFunction_t, const char *, uint32_t, void *, uint32_t, TaskHandle_t *) { return pdPASS; }
inline void xTaskDelayUntil(TickType_t *, TickType_t) {}
inline void vTaskDelay(TickType_t ticks) { gmTestMillis += ticks; }
inline TickType_t xTaskGetTickCount() { return gmTestMillis; }
