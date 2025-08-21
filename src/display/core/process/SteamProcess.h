#ifndef STEAMPROCESS_H
#define STEAMPROCESS_H

#include <display/core/constants.h>
#include <display/core/process/Process.h>

class SteamProcess : public Process {
  public:
    float pumpValue = 4.f;
    int duration;
    unsigned long started;

    explicit SteamProcess(int duration = STEAM_SAFETY_DURATION_MS, float pumpValue = 4.f)
        : pumpValue(pumpValue), duration(duration) {
        started = millis();
    }

    bool isRelayActive() override { return false; };

    bool isAltRelayActive() override { return false; };

    float getPumpValue() override { return isActive() ? pumpValue : 0.f; };

    void progress() override {
        // Stateless implmentation
    };

    bool isActive() override {
        unsigned long now = millis();
        return now - started < duration;
    };

    bool isComplete() override { return !isActive(); };

    int getType() override { return MODE_STEAM; }

    void updateVolume(double volume) override {};
};

#endif // STEAMPROCESS_H
