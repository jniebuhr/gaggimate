#pragma once
#ifndef GAGGIMATE_MEMORY_MONITOR_H
#define GAGGIMATE_MEMORY_MONITOR_H

#include <ESPMemoryMonitor.h>

namespace gaggimate::memmon {

void init();
ESPMemoryMonitor &instance();
bool isReady();

} // namespace gaggimate::memmon

#endif // GAGGIMATE_MEMORY_MONITOR_H
