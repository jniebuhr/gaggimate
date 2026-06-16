// Host shim umbrella for <Arduino.h>. Pulls the vendored Arduino classes and
// defines the Arduino global vocabulary on top of the desktop C/C++ runtime.
// Kept C-safe: LVGL's C sources include this for millis() via LV_TICK_CUSTOM.
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp32-hal-log.h"
#include "esp32-hal.h"
#include "esp_log.h"
#include "esp_system.h"
#include "pgmspace.h"

// Opaque on the host; the firmware only stores a hw_timer_t* it never uses here.
typedef struct hw_timer_s hw_timer_t;

#define HIGH 1
#define LOW 0
#define INPUT 0x01
#define OUTPUT 0x03
#define INPUT_PULLUP 0x05
#define INPUT_PULLDOWN 0x09
#define LSBFIRST 0
#define MSBFIRST 1
#define PI 3.1415926535897932384626433832795
#define HALF_PI 1.5707963267948966192313216916398
#define TWO_PI 6.283185307179586476925286766559
#define DEG_TO_RAD 0.017453292519943295769236907684886
#define RAD_TO_DEG 57.295779513082320876798154814105

#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))
#define radians(deg) ((deg) * DEG_TO_RAD)
#define degrees(rad) ((rad) * RAD_TO_DEG)
#define sq(x) ((x) * (x))
#define _min(a, b) ((a) < (b) ? (a) : (b))
#define _max(a, b) ((a) > (b) ? (a) : (b))
#define bit(b) (1UL << (b))
#define bitRead(value, b) (((value) >> (b)) & 0x01)
#define bitSet(value, b) ((value) |= (1UL << (b)))
#define bitClear(value, b) ((value) &= ~(1UL << (b)))
#define bitWrite(value, b, bv) ((bv) ? bitSet(value, b) : bitClear(value, b))
#define lowByte(w) ((uint8_t)((w) & 0xff))
#define highByte(w) ((uint8_t)((w) >> 8))
#define interrupts()
#define noInterrupts()

#ifdef __cplusplus

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "Esp.h"
#include "IPAddress.h"
#include "Print.h"
#include "Printable.h"
#include "Stream.h"
#include "WString.h"
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

typedef uint8_t byte;
typedef bool boolean;
typedef uint16_t word;

// Mirror the real ESP32 Arduino.h: keep std::min/std::max rather than macros.
using std::max;
using std::min;

// GPIO is meaningless on the host; keep the API so firmware compiles.
inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return 0; }
inline int analogRead(uint8_t) { return 0; }
inline void analogWrite(uint8_t, int) {}

inline long map(long x, long inMin, long inMax, long outMin, long outMax) {
    if (inMax == inMin)
        return outMin;
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
inline long random(long howbig) { return howbig ? (rand() % howbig) : 0; }
inline long random(long howsmall, long howbig) { return howbig > howsmall ? howsmall + random(howbig - howsmall) : howsmall; }
inline void randomSeed(unsigned long seed) { srand((unsigned)seed); }

// Host clock is already wall-clock; NTP setup calls are no-ops.
inline void configTime(long, int, const char *, const char * = nullptr, const char * = nullptr) {}
inline void configTzTime(const char *, const char *, const char * = nullptr, const char * = nullptr) {}
inline bool getLocalTime(struct tm *info, uint32_t ms = 5000) {
    (void)ms;
    time_t now = time(nullptr);
    localtime_r(&now, info);
    return true;
}

// Minimal Serial backed by stdout/stdin.
class HardwareSerial : public Stream {
  public:
    void begin(unsigned long = 115200) {}
    void end() {}
    operator bool() const { return true; }
    size_t write(uint8_t c) override { return fwrite(&c, 1, 1, stdout); }
    size_t write(const uint8_t *buffer, size_t size) override { return fwrite(buffer, 1, size, stdout); }
    int available() override { return 0; }
    int read() override { return -1; }
    int peek() override { return -1; }
    void flush() override { fflush(stdout); }
};

extern HardwareSerial Serial;

#endif // __cplusplus
