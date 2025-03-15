#ifndef PROCESS_H
#define PROCESS_H

#include "constants.h"
#include "predictive.h"

constexpr double PREDICTIVE_TIME = 2000.0; // time window for the prediction
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

    virtual int getType() = 0;

    virtual void updateVolume(double volume) = 0;
};

enum class BrewPhase { INFUSION_PRESSURIZE, INFUSION_PUMP, INFUSION_BLOOM, BREW_PRESSURIZE, BREW_PUMP, BREW_DRIP, FINISHED };

enum class ProcessTarget { TIME, VOLUMETRIC };

class BrewProcess : public Process {
  public:
    BrewPhase phase = BrewPhase::INFUSION_PRESSURIZE;
    ProcessTarget target;
    int infusionPumpTime;
    int infusionBloomTime;
    int brewTime;
    int brewVolume;
    int brewPressurize;
    double brewDelay;
    unsigned long currentPhaseStarted = 0;
    unsigned long previousPhaseFinished = 0;
    double currentVolume = 0; // most recent volume pushed
    VolumetricRateCalculator *volumetricRateCalculator = nullptr;

    explicit BrewProcess(ProcessTarget target = ProcessTarget::TIME, int pressurizeTime = 0, int infusionPumpTime = 0,
                         int infusionBloomTime = 0, int brewTime = 0, int brewVolume = 0, double brewDelay = 0.0)
        : target(target), infusionPumpTime(infusionPumpTime), infusionBloomTime(infusionBloomTime), brewTime(brewTime),
          brewVolume(brewVolume), brewPressurize(pressurizeTime), brewDelay(brewDelay),
          volumetricRateCalculator(new VolumetricRateCalculator(PREDICTIVE_TIME)) {
        if (infusionBloomTime == 0 || infusionPumpTime == 0) {
            phase = BrewPhase::BREW_PRESSURIZE;
        } else if (pressurizeTime == 0) {
            phase = BrewPhase::INFUSION_PUMP;
        }
        currentPhaseStarted = millis();
    }

    void updateVolume(double volume) override { // called even after the Process is no longer active
        currentVolume = volume;
        if (phase != BrewPhase::BREW_DRIP && phase != BrewPhase::FINISHED) { // only store measurements while active
            volumetricRateCalculator->addMeasurement(volume);
        }
    }

    unsigned long getPhaseDuration() const {
        switch (phase) {
        case BrewPhase::INFUSION_PRESSURIZE:
            return brewPressurize;
        case BrewPhase::INFUSION_PUMP:
            return infusionPumpTime;
        case BrewPhase::INFUSION_BLOOM:
            return infusionBloomTime;
        case BrewPhase::BREW_PRESSURIZE:
            return brewPressurize;
        case BrewPhase::BREW_PUMP:
            return brewTime;
        case BrewPhase::BREW_DRIP:
            return PREDICTIVE_TIME;
        default:
            return 0;
        }
    }

    bool isCurrentPhaseFinished() {
        if (phase == BrewPhase::BREW_PUMP && target == ProcessTarget::VOLUMETRIC) {
            if (millis() - currentPhaseStarted > BREW_SAFETY_DURATION_MS) {
                return true;
            }
            double currentRate = volumetricRateCalculator->getRate();
            const double predictedAddedVolume = currentRate * brewDelay;
            return currentVolume + predictedAddedVolume >= brewVolume;
        }
        if (phase != BrewPhase::FINISHED) {
            return millis() - currentPhaseStarted > getPhaseDuration();
        }
        return true;
    }

    double getNewDelayTime() const {
        return brewDelay - volumetricRateCalculator->getOvershootAdjustMillis(double(brewVolume), currentVolume);
    }

    bool isRelayActive() override {
        return phase == BrewPhase::INFUSION_PUMP || phase == BrewPhase::INFUSION_BLOOM || phase == BrewPhase::BREW_PUMP;
    }

    bool isAltRelayActive() override { return false; }

    float getPumpValue() override {
        if (phase == BrewPhase::INFUSION_PRESSURIZE || phase == BrewPhase::INFUSION_PUMP || phase == BrewPhase::BREW_PRESSURIZE ||
            phase == BrewPhase::BREW_PUMP) {
            return 100.f;
        }
        return 0.f;
    }

    void progress() override {
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL, while the Process is active

        if (isCurrentPhaseFinished()) {
            previousPhaseFinished = millis();
            switch (phase) {
            case BrewPhase::INFUSION_PRESSURIZE:
                phase = BrewPhase::INFUSION_PUMP;
                break;
            case BrewPhase::INFUSION_PUMP:
                phase = BrewPhase::INFUSION_BLOOM;
                break;
            case BrewPhase::INFUSION_BLOOM:
                phase = BrewPhase::BREW_PRESSURIZE;
                break;
            case BrewPhase::BREW_PRESSURIZE:
                phase = BrewPhase::BREW_PUMP;
                break;
            case BrewPhase::BREW_PUMP:
                phase = BrewPhase::BREW_DRIP;
                return;
            case BrewPhase::BREW_DRIP:
                phase = BrewPhase::FINISHED;
                return;
            default:;
            }
            currentPhaseStarted = millis();
        }
    }

    bool isActive() override { return phase != BrewPhase::FINISHED; }

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
            if (currentVolume + currentRate * grindDelay > grindVolume) {
                active = false;
                finished = millis();
            }
        }
    }

    double getNewDelayTime() const {
        return grindDelay - volumetricRateCalculator->getOvershootAdjustMillis(double(grindVolume), currentVolume);
    }

    bool isActive() override {
        if (target == ProcessTarget::TIME) {
            return millis() - started < time;
        }
        return active || (finished + PREDICTIVE_TIME > millis());
    }

    int getType() override { return MODE_GRIND; }
};

#endif // PROCESS_H
