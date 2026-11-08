// Global Arduino/ESP singletons + host timing implementation.
#include "Arduino.h"
#include "ESPmDNS.h"
#include "WiFi.h"

#include <chrono>
#include <cstdlib>
#include <ctime>
#include <thread>
#include <unistd.h>

// Seed the host PRNG once at startup so esp_random() (and thus generated profile
// IDs etc.) differs every run — otherwise rand() repeats the same sequence and
// new profiles reuse old IDs, overwriting them. On device esp_random() is hardware.
namespace {
struct RngSeeder {
    RngSeeder() { srand(static_cast<unsigned>(time(nullptr) ^ (static_cast<long>(getpid()) << 16))); }
} g_rngSeeder;
} // namespace

HardwareSerial Serial;
EspClass ESP;
MDNSResponder MDNS;
WiFiClass WiFi;

static std::chrono::steady_clock::time_point g_start = std::chrono::steady_clock::now();

extern "C" {

unsigned long millis(void) {
    auto now = std::chrono::steady_clock::now();
    return (unsigned long)std::chrono::duration_cast<std::chrono::milliseconds>(now - g_start).count();
}

unsigned long micros(void) {
    auto now = std::chrono::steady_clock::now();
    return (unsigned long)std::chrono::duration_cast<std::chrono::microseconds>(now - g_start).count();
}

void delay(uint32_t ms) { std::this_thread::sleep_for(std::chrono::milliseconds(ms)); }
void delayMicroseconds(uint32_t us) { std::this_thread::sleep_for(std::chrono::microseconds(us)); }
void yield(void) { std::this_thread::yield(); }

int64_t esp_timer_get_time(void) {
    auto now = std::chrono::steady_clock::now();
    return (int64_t)std::chrono::duration_cast<std::chrono::microseconds>(now - g_start).count();
}

} // extern "C"
