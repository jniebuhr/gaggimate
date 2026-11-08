#ifndef HEATINGCHECK_H
#define HEATINGCHECK_H

#include <algorithm>
#include <cmath>
#include <cstdint>

// Measures SSR command duty after heater arbitration.
class HeatingCheck {
  public:
    enum class Fault { None, NoRise, UnexpectedRise };
    static constexpr float MIN_RISE_C = 2.0f;
    static constexpr float TARGET_MARGIN_C = 10.0f;
    static constexpr float MAX_OFF_RISE_C = 10.0f;
    static constexpr uint32_t DUTY_WINDOW_MS = 5000;
    static constexpr uint32_t MIN_DUTY_PERCENT = 85;
    static constexpr uint32_t SENSOR_SETTLE_MS = 10000;

    explicit HeatingCheck(uint32_t heatingTimeMs = 30000) : heatingTimeMs(heatingTimeMs) {}
    void setHeatingTime(uint32_t ms) { heatingTimeMs = ms; }
    float getFaultBaseline(Fault fault) const { return fault == Fault::NoRise ? riseBaseline : offMinimum; }

    Fault update(uint32_t now, float temperature, float target, uint32_t totalOnMs, bool on, bool pumping = false) {
        if (!std::isfinite(temperature) || temperature <= 0.0f)
            return Fault::None; // Sensor validation remains the sensor driver's responsibility.
        if (!initialized) {
            initialized = true;
            startedAt = now;
            previousOnMs = totalOnMs;
            riseBaseline = offMinimum = temperature;
        }
        const uint32_t poweredMs = totalOnMs - previousOnMs;
        previousOnMs = totalOnMs;
        if (on || poweredMs != 0) {
            offMinimum = temperature;
        } else if (now - startedAt < SENSOR_SETTLE_MS) {
            // Existing thermocouple filtering ramps from zero on startup.
            offMinimum = temperature;
        } else {
            offMinimum = std::min(offMinimum, temperature);
            // Ten degrees of residual rise is allowed after output switches off.
            if (temperature - offMinimum > MAX_OFF_RISE_C)
                return Fault::UnexpectedRise;
        }

        // Pumping can remove heat faster than the boiler gains it. Start a fresh
        // observation after pumping; unexpected heating above remains monitored.
        // Maintenance duty and coordinator pauses must not accumulate into a heating test.
        if (pumping || target <= 0 || temperature >= target - TARGET_MARGIN_C) {
            watchingRise = false;
            dutyOnMs = 0;
            return Fault::None;
        }
        if (!watchingRise) {
            watchingRise = true;
            riseBaseline = temperature;
            riseStartedAt = dutyStartedAt = now;
            dutyOnMs = 0;
            return Fault::None;
        }
        dutyOnMs += poweredMs;
        const uint32_t elapsed = now - dutyStartedAt;
        if (elapsed >= DUTY_WINDOW_MS) {
            if (static_cast<uint64_t>(dutyOnMs) * 100 < static_cast<uint64_t>(elapsed) * MIN_DUTY_PERCENT) {
                watchingRise = false;
                dutyOnMs = 0;
                return Fault::None;
            }
            dutyStartedAt = now;
            dutyOnMs = 0;
            // Only consecutive high-duty blocks qualify; elapsed time is bounded.
            if (now - riseStartedAt >= heatingTimeMs) {
                if (temperature < riseBaseline + MIN_RISE_C)
                    return Fault::NoRise;
                riseBaseline = temperature;
                riseStartedAt = now;
            }
        }
        return Fault::None;
    }

  private:
    uint32_t heatingTimeMs;
    uint32_t startedAt = 0;
    uint32_t previousOnMs = 0;
    uint32_t riseStartedAt = 0;
    uint32_t dutyStartedAt = 0;
    uint32_t dutyOnMs = 0;
    float riseBaseline = 0;
    float offMinimum = 0;
    bool initialized = false;
    bool watchingRise = false;
};

#endif
