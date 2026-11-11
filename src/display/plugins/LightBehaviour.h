#pragma once
#include <LedEffect.h>
#include <cmath>
#include <cstdint>

// The display owns process state and resolves the user's light function.
class LightBehaviour {
  public:
    LedEffect update(uint32_t function, float temperature, float target, bool stable, bool awake, bool brewing) {
        if (function != previousFunction || target != previousTarget || !awake)
            steamReady = false;
        previousFunction = function;
        previousTarget = target;
        if (function == 3)
            return awake ? LedEffect::On : LedEffect::Off;
        if (function == 4)
            return brewing ? LedEffect::On : LedEffect::Off;
        if ((function != 1 && function != 2 && function != 5 && function != 6) || !awake || target <= 0 || !std::isfinite(target))
            return LedEffect::Off;
        if (function == 1 || function == 5) {
            if (!std::isfinite(temperature)) {
                steamReady = false;
                return LedEffect::Off;
            }
            const float error = std::fabs(temperature - target);
            if (error <= 2.0f)
                steamReady = true;
            else if (error > 5.0f)
                steamReady = false;
            stable = steamReady;
        }
        return stable ? LedEffect::On : function >= 5 ? LedEffect::Flashing : LedEffect::Breathing;
    }

  private:
    uint32_t previousFunction = 0;
    float previousTarget = 0;
    bool steamReady = false;
};
