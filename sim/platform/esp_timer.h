// Host shim for esp_timer.h.
#pragma once

#include <stdint.h>

int64_t esp_timer_get_time(void); // microseconds since start (impl in arduino_shim.cpp)
