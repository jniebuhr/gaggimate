// Host shim for Arduino esp32-hal.h timing primitives.
#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

unsigned long millis(void);
unsigned long micros(void);
void delay(uint32_t ms);
void delayMicroseconds(uint32_t us);
void yield(void);

#ifdef __cplusplus
}
#endif
