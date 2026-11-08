#pragma once
#include <cstdint>

// Selected through ControllerConfig; PSM zero-cross timing is independent.
enum class PressureControlRate : uint8_t { Hz50 = 50, Hz60 = 60 };

constexpr float pressureControlPeriodS(PressureControlRate rate) {
    return rate == PressureControlRate::Hz50 ? 1.0f / 50.0f : 1.0f / 60.0f;
}

constexpr uint8_t pressureControlIntervalMs(PressureControlRate rate, uint8_t index) {
    return rate == PressureControlRate::Hz50 ? 20 : (index % 3 == 2 ? 16 : 17);
}
