#pragma once
#include <cstdint>
unsigned long &testClock();
inline unsigned long millis() { return testClock(); }
