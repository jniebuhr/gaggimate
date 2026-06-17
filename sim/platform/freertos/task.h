// Host shim for freertos/task.h.
//
// xTaskCreate* are deliberate no-ops: the simulator never spawns the firmware's
// FreeRTOS tasks. Instead sim/main.cpp drives the single-iteration loop methods
// cooperatively on the main thread (keeps LVGL/SDL single-threaded on macOS).
#pragma once

#include "FreeRTOS.h"
#include "esp32-hal.h"
#include <stdint.h>

typedef void *TaskHandle_t;
typedef TaskHandle_t xTaskHandle;
typedef void (*TaskFunction_t)(void *);

typedef enum { eRunning = 0, eReady, eBlocked, eSuspended, eDeleted, eInvalid } eTaskState;

// Sentinel handle handed back by the no-op creators so isTaskHealthy() passes.
#define GM_SIM_TASK_HANDLE ((TaskHandle_t)0x1)

static inline BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char *name, uint32_t stack, void *param,
                                                 UBaseType_t prio, TaskHandle_t *handle, BaseType_t core) {
    (void)fn;
    (void)name;
    (void)stack;
    (void)param;
    (void)prio;
    (void)core;
    if (handle)
        *handle = GM_SIM_TASK_HANDLE;
    return pdPASS;
}

static inline BaseType_t xTaskCreate(TaskFunction_t fn, const char *name, uint32_t stack, void *param, UBaseType_t prio,
                                     TaskHandle_t *handle) {
    return xTaskCreatePinnedToCore(fn, name, stack, param, prio, handle, tskNO_AFFINITY);
}

static inline void vTaskDelay(TickType_t ticks) { delay((uint32_t)ticks); }
static inline BaseType_t xTaskDelayUntil(TickType_t *prevWakeTime, TickType_t increment) {
    delay((uint32_t)increment);
    if (prevWakeTime)
        *prevWakeTime += increment;
    return pdTRUE;
}
static inline void vTaskDelayUntil(TickType_t *prevWakeTime, TickType_t increment) { xTaskDelayUntil(prevWakeTime, increment); }
static inline void vTaskDelete(TaskHandle_t handle) { (void)handle; }
static inline eTaskState eTaskGetState(TaskHandle_t handle) {
    (void)handle;
    return eRunning;
}
static inline TaskHandle_t xTaskGetCurrentTaskHandle(void) { return GM_SIM_TASK_HANDLE; }
static inline TickType_t xTaskGetTickCount(void) { return (TickType_t)millis(); }
static inline void taskYIELD(void) {}
