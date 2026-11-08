#pragma once
#include <Arduino.h>
#include <LedEffect.h>
#include <algorithm>
#include <atomic>
#include <cmath>

// LEDC generates the carrier; the existing controller loop advances the envelope.
class PwmLight {
  public:
    PwmLight(uint8_t pin, uint8_t channel) : pin(pin), channel(channel) {}
    void setup() {
        ledcSetup(channel, 5000, 8);
        ledcWrite(channel, 0);
        ledcAttachPin(pin, channel);
    }
    void set(LedEffect effect, uint8_t brightness, uint8_t minimum, uint16_t cycleTimeMs) {
        minimum = std::min(minimum, brightness);
        cycleTimeMs = std::max(MIN_LED_CYCLE_MS, std::min(cycleTimeMs, MAX_LED_CYCLE_MS));
        command.store(brightness | (uint32_t{minimum} << 8) | (static_cast<uint32_t>(effect) << 16) |
                      (uint32_t{cycleTimeMs} << 18));
    }
    void stop() { command.fetch_and(~(3u << 16)); }
    void update(uint32_t now, bool fault = false, bool enabled = true) {
        const uint32_t value = command.load();
        const uint8_t brightness = value & 0xFF;
        const uint8_t minimum = (value >> 8) & 0xFF;
        const uint16_t cycleTimeMs = value >> 18;
        const uint8_t mode = fault ? 4 : enabled ? (value >> 16) & 3 : 0;
        if (mode != previousMode || cycleTimeMs != previousCycleTimeMs) {
            previousMode = mode;
            previousCycleTimeMs = cycleTimeMs;
            startedAt = now;
        }
        const uint32_t elapsed = now - startedAt;
        uint8_t duty = 0;
        if (mode == static_cast<uint8_t>(LedEffect::On))
            duty = brightness;
        else if (mode == static_cast<uint8_t>(LedEffect::Flashing))
            duty = elapsed % cycleTimeMs < cycleTimeMs / 2 ? brightness : minimum;
        else if (mode == static_cast<uint8_t>(LedEffect::Breathing))
            duty = static_cast<uint8_t>(
                minimum + (brightness - minimum) * (0.5f - 0.5f * std::cos((elapsed % cycleTimeMs) * 6.2831853f / cycleTimeMs)));
        else if (mode == 4) {
            // Fault flashes retain their distinctive timing and a fully dark low phase.
            const uint32_t phase = elapsed % 1350;
            duty = phase < 600 && (phase / 100) % 2 == 0 ? brightness : 0;
        }
        if (duty != lastDuty) {
            ledcWrite(channel, duty);
            lastDuty = duty;
        }
    }

  private:
    static_assert(MAX_LED_CYCLE_MS < (1u << 14), "LED cycle must fit the atomic command");
    uint8_t pin;
    uint8_t channel;
    // Max: 8 bits, min: 8 bits, effect: 2 bits, cycle milliseconds: 14 bits.
    std::atomic<uint32_t> command{255u | (uint32_t{DEFAULT_LED_CYCLE_MS} << 18)};
    uint32_t startedAt = 0;
    uint16_t previousCycleTimeMs = 0;
    uint8_t previousMode = 0;
    uint8_t lastDuty = 0;
};
