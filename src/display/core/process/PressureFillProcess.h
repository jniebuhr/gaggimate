#ifndef PRESSUREFILLPROCESS_H
#define PRESSUREFILLPROCESS_H

#include <Arduino.h>
#include <display/core/constants.h>
#include <display/core/process/Process.h>
#include <esp_log.h>
#include <functional>

// Pump with brew valve closed until pressure stays at/above threshold for hold time.
class PressureFillProcess : public Process {
  public:
    using PressureReader = std::function<float()>;

    PressureFillProcess(PressureReader reader, float pressureThreshold, unsigned long holdTimeMs, unsigned long maxTimeMs)
        : getPressure(std::move(reader)), pressureThreshold(pressureThreshold), holdTimeMs(holdTimeMs), maxTimeMs(maxTimeMs) {
        started = millis();
    }

    bool isRelayActive() override { return false; }

    bool isAltRelayActive() override { return false; }

    float getPumpValue() override { return isActive() ? 100.f : 0.f; }

    void progress() override {
        if (finished)
            return;

        const unsigned long now = millis();
        const unsigned long elapsed = now - started;

        if (elapsed >= maxTimeMs) {
            ESP_LOGW(LOG_TAG, "No pressure rise after %lu ms", maxTimeMs);
            finished = true;
            return;
        }

        const float pressure = getPressure ? getPressure() : 0.f;
        if (pressure >= pressureThreshold) {
            if (aboveSince == 0)
                aboveSince = now;
            if (now - aboveSince >= holdTimeMs) {
                ESP_LOGI(LOG_TAG, "Boiler full after %lu ms", elapsed);
                finished = true;
            }
        } else {
            aboveSince = 0;
        }
    }

    bool isActive() override { return !finished; }

    bool isComplete() override { return finished; }

    int getType() override { return MODE_WATER; }

    void updateVolume(double volume) override {}

  private:
    static constexpr const char *LOG_TAG = "PressureFill";

    PressureReader getPressure;
    float pressureThreshold;
    unsigned long holdTimeMs;
    unsigned long maxTimeMs;
    unsigned long started = 0;
    unsigned long aboveSince = 0;
    bool finished = false;
};

#endif // PRESSUREFILLPROCESS_H
