#ifndef PUMPPROCESS_H
#define PUMPPROCESS_H

#include <algorithm>
#include <display/core/constants.h>
#include <display/core/predictive.h>
#include <display/core/process/Process.h>

class PumpProcess : public Process {
  public:
    ProcessTarget target;
    unsigned int targetTime = 0;
    double targetVolume = 0;
    bool active = true;
    double currentVolume = 0;
    float pumpValue = 100;
    unsigned int phase = 0;
    unsigned long started = 0;
    unsigned long finished = 0;
    VolumetricRateCalculator volumetricRateCalculator{PREDICTIVE_TIME};

    explicit PumpProcess(ProcessTarget target = ProcessTarget::TIME, int time = HOT_WATER_SAFETY_DURATION_MS, double volume = 0.0)
        : target(target), targetTime(time), targetVolume(volume) {
        started = millis();
        if (target == ProcessTarget::VOLUMETRIC) {
            targetTime = HOT_WATER_SAFETY_DURATION_MS;
        } else {
            targetTime = constrain(targetTime, HOT_WATER_MIN_DURATION_MS, HOT_WATER_MAX_DURATION_MS);
            targetTime = (targetTime == 0) ? HOT_WATER_SAFETY_DURATION_MS : targetTime;
        }
    }

    bool isRelayActive() override { return false; };

    bool isAltRelayActive() override { return false; };

    float getPumpValue() override { return isActive() ? pumpValue : 0.f; };

    void progress() override {
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL, while PumpProcess is active
        if (millis() - started > targetTime) {
            active = false;
            return;
        }
        if (target == ProcessTarget::VOLUMETRIC) {
            double currentRate = volumetricRateCalculator.getRate();
            if (currentVolume >= targetVolume && active && phase == 0) {
                phase = 1;
                pumpValue = 0.0;
            } else if (currentRate == 0 && phase == 1) {
                phase = 2;
            } else if (phase == 2) {
                pumpValue = constrain(5.0 * (targetVolume - currentVolume), 5, 30);
                if (currentVolume >= targetVolume && active) {
                    active = false;
                    finished = millis();
                }
            }
        }
    };

    bool isActive() override { return active; };

    bool isComplete() override { return !isActive(); };

    int getType() override { return MODE_WATER; }

    void updateVolume(double volume) override {
        currentVolume = volume;
        if (active) {
            volumetricRateCalculator.addMeasurement(volume);
        }
    };
};

#endif // PUMPPROCESS_H
