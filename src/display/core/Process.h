#ifndef PROCESS_H
#define PROCESS_H

#include <display/models/profile.h>

#include "constants.h"
#include "predictive.h"

constexpr double PREDICTIVE_TIME = 4000.0; // time window for the prediction
// constexpr double PREDICTIVE_TIME_MS = 1000.0;

class Process {
  public:
    Process() = default;
    virtual ~Process() = default;

    virtual bool isRelayActive() = 0;

    virtual bool isAltRelayActive() = 0;

    virtual float getPumpValue() = 0;

    virtual void progress() = 0;

    virtual bool isActive() = 0;

    virtual bool isComplete() = 0;

    virtual int getType() = 0;

    virtual void updateVolume(double volume) = 0;
};

enum class ProcessTarget { VOLUMETRIC, TIME };
enum class ProcessPhase { RUNNING, FINISHED };
;

class BrewProcess : public Process {
  public:
    Profile profile;
    ProcessTarget target;
    double brewDelay;
    unsigned int phaseIndex = 0;
    Phase currentPhase;
    ProcessPhase processPhase = ProcessPhase::RUNNING;
    unsigned long processStarted = 0;
    unsigned long currentPhaseStarted = 0;
    unsigned long previousPhaseFinished = 0;
    unsigned long finished = 0;
    double currentVolume = 0; // most recent volume pushed
    VolumetricRateCalculator *volumetricRateCalculator = nullptr;

    explicit BrewProcess(Profile profile, ProcessTarget target, double brewDelay = 0.0)
        : profile(profile), target(target), brewDelay(brewDelay),
          volumetricRateCalculator(new VolumetricRateCalculator(PREDICTIVE_TIME)) {
        currentPhase = profile.phases.at(phaseIndex);
        processStarted = millis();
        currentPhaseStarted = millis();
    }

    void updateVolume(double volume) override { // called even after the Process is no longer active
        currentVolume = volume;
        if (processPhase != ProcessPhase::FINISHED) { // only store measurements while active
            volumetricRateCalculator->addMeasurement(volume);
        }
    }

    unsigned long getTotalDuration() const { return profile.getTotalDuration() * 1000L; }

    unsigned long getPhaseDuration() const { return static_cast<long>(currentPhase.duration) * 1000L; }

    bool isCurrentPhaseFinished() {
        if (target == ProcessTarget::VOLUMETRIC && currentPhase.hasVolumetricTarget()) {
            if (millis() - currentPhaseStarted > BREW_SAFETY_DURATION_MS) {
                return true;
            }
            double currentRate = volumetricRateCalculator->getRate();
            const double predictedAddedVolume = currentRate * brewDelay;
            Target target = currentPhase.getVolumetricTarget();
            return currentVolume + predictedAddedVolume >= target.value;
        }
        if (processPhase != ProcessPhase::FINISHED) {
            return millis() - currentPhaseStarted > getPhaseDuration();
        }
        return true;
    }

    double getBrewVolume() const {
        double brewVolume = 0;
        for (const auto &phase : profile.phases) {
            if (phase.hasVolumetricTarget()) {
                Target target = phase.getVolumetricTarget();
                brewVolume = target.value;
            }
        }
        return brewVolume;
    }

    double getNewDelayTime() const {
        double newDelay = brewDelay + volumetricRateCalculator->getOvershootAdjustMillis(double(getBrewVolume()), currentVolume);
        if (newDelay < 0.0)
            newDelay = 0.0;
        if (newDelay > PREDICTIVE_TIME)
            newDelay = PREDICTIVE_TIME;
        return newDelay;
    }

    bool isRelayActive() override {
        if (processPhase == ProcessPhase::FINISHED) {
            return false;
        }
        return currentPhase.valve;
    }

    bool isAltRelayActive() override { return false; }

    float getPumpValue() override {
        if (processPhase == ProcessPhase::FINISHED) {
            return 0.0f;
        }
        return currentPhase.pumpIsSimple ? currentPhase.pumpSimple : 100.0f;
    }

    bool isAdvancedPump() const { return processPhase != ProcessPhase::FINISHED && !currentPhase.pumpIsSimple; }

    float getPumpTargetPressure() const {
        if (isAdvancedPump()) {
            return currentPhase.pumpAdvanced.pressure;
        }
        return 0.0f;
    }

    void progress() override {
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL, while the Process is active
        if (isCurrentPhaseFinished() && processPhase == ProcessPhase::RUNNING) {
            previousPhaseFinished = millis();
            if (phaseIndex + 1 < profile.phases.size()) {
                phaseIndex++;
                currentPhase = profile.phases.at(phaseIndex);
                currentPhaseStarted = millis();
            } else {
                processPhase = ProcessPhase::FINISHED;
                finished = millis();
            }
        }
    }

    bool isActive() override { return processPhase == ProcessPhase::RUNNING; }

    bool isComplete() override {
        if (target == ProcessTarget::TIME) {
            return !isActive();
        }
        return processPhase == ProcessPhase::FINISHED && millis() - finished > PREDICTIVE_TIME;
    }

    int getType() override { return MODE_BREW; }
};

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

class PumpProcess : public Process {
  public:
    int duration;
    unsigned long started;

    explicit PumpProcess(int duration = HOT_WATER_SAFETY_DURATION_MS) : duration(duration) { started = millis(); }

    bool isRelayActive() override { return false; };

    bool isAltRelayActive() override { return false; };

    float getPumpValue() override { return isActive() ? 100.f : 0.f; };

    void progress() override {
        // Stateless implementation
    };

    bool isActive() override {
        unsigned long now = millis();
        return now - started < duration;
    };

    bool isComplete() override { return !isActive(); };

    int getType() override { return MODE_WATER; }

    void updateVolume(double volume) override {};
};

class GrindProcess : public Process {
  public:
    ProcessTarget target;
    bool active = true;
    int time;
    int grindVolume;
    double grindDelay;
    unsigned long started;
    unsigned long finished{};
    double currentVolume = 0;
    VolumetricRateCalculator *volumetricRateCalculator = nullptr;

    explicit GrindProcess(ProcessTarget target = ProcessTarget::TIME, int time = 0, int volume = 0, double grindDelay = 0.0)
        : target(target), time(time), grindVolume(volume), grindDelay(grindDelay),
          volumetricRateCalculator(new VolumetricRateCalculator(PREDICTIVE_TIME)) {
        started = millis();
    }

    void updateVolume(double volume) override {
        currentVolume = volume;
        if (active) { // only store measurements while active
            volumetricRateCalculator->addMeasurement(volume);
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
            double currentRate = volumetricRateCalculator->getRate();
            ESP_LOGI("GrindProcess", "Current rate: %f, Current volume: %f, Expected Offset: %f", currentRate, currentVolume,
                     currentRate * grindDelay);
            if (currentVolume + currentRate * grindDelay > grindVolume && active) {
                active = false;
                finished = millis();
            }
        }
    }

    double getNewDelayTime() const {
        double newDelay = grindDelay + volumetricRateCalculator->getOvershootAdjustMillis(double(grindVolume), currentVolume);
        ESP_LOGI("GrindProcess", "Setting new delay time - Old: %2f, Expected Volume: %d, Actual Volume: %2f, New Delay: %f",
                 grindDelay, grindVolume, currentVolume, newDelay);
        if (newDelay < 0.0)
            newDelay = 0.0;
        if (newDelay > PREDICTIVE_TIME)
            newDelay = PREDICTIVE_TIME;
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

#endif // PROCESS_H
