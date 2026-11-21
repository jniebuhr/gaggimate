#ifndef LAG_COMPENSATION_LIMITS_H
#define LAG_COMPENSATION_LIMITS_H

#include <algorithm>
#include <cmath>

// Accepted ranges for the brew-boiler lag compensation settings (HeaterLagCompensation). The display clamps what it
// stores and the controller clamps what it receives, so neither trusts the other; the web UI mirrors these numbers
// (web/src/pages/Settings/tabs/LagCompensationSection.jsx). Anything <= 0 or not a number means "off".
namespace lag_limits {

struct Range {
    float min;
    float max;
};

constexpr Range DERIVATIVE_FILTER_S{0.5f, 10.0f}; // longer filters delay the D term's braking (worse overshoot)
constexpr Range INTEGRAL_ZONE_C{0.5f, 5.0f};      // below ~0.5 degC the band is inside sensor noise
constexpr Range SENSOR_DEAD_TIME_S{2.0f, 60.0f};  // sensor in the water ... very slow shell-mounted thermocouple

// 0 for off (<= 0 or not finite), otherwise clamped into the range.
inline float clampOrOff(float value, Range range) {
    if (!std::isfinite(value) || value <= 0.0f)
        return 0.0f;
    return std::min(std::max(value, range.min), range.max);
}

} // namespace lag_limits

#endif // LAG_COMPENSATION_LIMITS_H
