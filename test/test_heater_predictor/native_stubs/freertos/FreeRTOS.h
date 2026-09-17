#pragma once

#include <cstdint>

using BaseType_t = int;
using TickType_t = uint32_t;
using TaskHandle_t = void *;
using xTaskHandle = TaskHandle_t;
using portMUX_TYPE = int;

constexpr BaseType_t pdPASS = 1;
constexpr uint32_t configMINIMAL_STACK_SIZE = 1024;
constexpr uint32_t portTICK_PERIOD_MS = 1;

#define portMUX_INITIALIZER_UNLOCKED 0
#define pdMS_TO_TICKS(ms) (static_cast<TickType_t>(ms))

inline void portENTER_CRITICAL(portMUX_TYPE *) {}
inline void portEXIT_CRITICAL(portMUX_TYPE *) {}
