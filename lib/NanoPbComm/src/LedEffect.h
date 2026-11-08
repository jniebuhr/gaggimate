#pragma once
#include <cstdint>

// Channels 0-7 retain Alba's PCA9634 brightness mapping.
constexpr uint8_t SYSTEM_LED_CHANNEL = 8;
constexpr uint8_t BARISTA_LED_CHANNEL = 9;
enum class LedEffect : uint8_t { Off = 0, Flashing = 1, Breathing = 2, On = 3 };

constexpr uint16_t DEFAULT_LED_CYCLE_MS = 3000;
constexpr uint16_t MIN_LED_CYCLE_MS = 500;
constexpr uint16_t MAX_LED_CYCLE_MS = 10000;
