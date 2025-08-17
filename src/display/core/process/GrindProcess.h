#ifndef GRINDPROCESS_H
#define GRINDPROCESS_H

#include <algorithm>
#include <display/core/constants.h>
#include <display/core/predictive.h>
#include <display/core/process/Process.h>

class GrindProcess : public Process {
  public:
    ProcessTarget target;
    bool active = true;
    int time;
    double grindVolume;
    double grindDelay;
    unsigned long started;
    unsigned long finished{};
    double currentVolume = 0;
    VolumetricRateCalculator volumetricRateCalculator{static_cast<double>(PREDICTIVE_TIME)};

    explicit GrindProcess(ProcessTarget target = ProcessTarget::TIME, int time = 0, double volume = 0, double grindDelay = 0.0)
        : target(target), time(time), grindVolume(volume), grindDelay(grindDelay) {
        started = millis();
    }

    void updateVolume(double volume) override {
        currentVolume = volume;
        if (active) { // only store measurements while active
            volumetricRateCalculator.addMeasurement(volume);
        }
    }

    bool isRelayActive() override { return false; }

    bool isAltRelayActive() override { return active; }

    float getPumpValue() override { return 0.f; }

    void progress() override {
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL, while GrindProcess is active
        if (target == ProcessTarget::TIME) {
            active = millis() - started < time;
        } else {
            double currentRate = volumetricRateCalculator.getRate();
            ESP_LOGI("GrindProcess", "Current rate: %f, Current volume: %f, Expected Offset: %f", currentRate, currentVolume,
                     currentRate * grindDelay);
            if (currentVolume + currentRate * grindDelay > grindVolume && active) {
                active = false;
                finished = millis();
            }
        }
    }

    double getNewDelayTime() {
        double newDelay = grindDelay + volumetricRateCalculator.getOvershootAdjustMillis(double(grindVolume), currentVolume);
        ESP_LOGI("GrindProcess", "Setting new delay time - Old: %2f, Expected Volume: %f, Actual Volume: %2f, New Delay: %f",
                 grindDelay, grindVolume, currentVolume, newDelay);
        newDelay = std::clamp(newDelay, 0.0, PREDICTIVE_TIME);
        return newDelay;
    }

    bool isActive() override {
        if (target == ProcessTarget::TIME) {
            return millis() - started < time;
        }
        return active;
    }

    bool isComplete() override {
        if (target == ProcessTarget::TIME)
            return !isActive();
        return millis() - finished > PREDICTIVE_TIME;
    }

    int getType() override { return MODE_GRIND; }
};

#endif // GRINDPROCESS_H
