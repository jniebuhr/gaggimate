#ifndef BREWPROCESS_H
#define BREWPROCESS_H

#include <display/core/constants.h>
#include <display/core/predictive.h>
#include <display/core/process/Process.h>

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
    float currentFlow = 0.0f;
    float currentPressure = 0.0f;
    float waterPumped = 0.0f;
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

    void updatePressure(float pressure) { currentPressure = pressure; }

    void updateFlow(float flow) { currentFlow = flow; }

    unsigned long getTotalDuration() const { return profile.getTotalDuration() * 1000L; }

    unsigned long getPhaseDuration() const { return static_cast<long>(currentPhase.duration) * 1000L; }

    bool isCurrentPhaseFinished() {
        if (millis() - currentPhaseStarted > BREW_SAFETY_DURATION_MS) {
            return true;
        }
        double volume = currentVolume;
        if (volume > 0.0) {
            double currentRate = volumetricRateCalculator->getRate();
            const double predictedAddedVolume = currentRate * brewDelay;
            volume += predictedAddedVolume;
        }
        float timeInPhase = static_cast<float>(millis() - currentPhaseStarted) / 1000.0f;
        return currentPhase.isFinished(target == ProcessTarget::VOLUMETRIC, volume, timeInPhase, currentFlow, currentPressure,
                                       waterPumped);
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
        newDelay = std::clamp(newDelay, 0.0, PREDICTIVE_TIME);
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

    [[nodiscard]] PumpTarget getPumpTarget() const { return currentPhase.pumpAdvanced.target; }

    float getPumpPressure() const {
        if (isAdvancedPump()) {
            return currentPhase.pumpAdvanced.pressure;
        }
        return 0.0f;
    }

    float getPumpFlow() const {
        if (isAdvancedPump()) {
            return currentPhase.pumpAdvanced.flow;
        }
        return 0.0f;
    }

    float getTemperature() const {
        if (currentPhase.temperature > 0.0f) {
            return currentPhase.temperature;
        }
        return profile.temperature;
    }

    void progress() override {
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL, while the Process is active
        waterPumped += currentFlow / 10.0f; // Add current flow divided to 100ms to water pumped counter
        if (isCurrentPhaseFinished() && processPhase == ProcessPhase::RUNNING) {
            previousPhaseFinished = millis();
            if (phaseIndex + 1 < profile.phases.size()) {
                waterPumped = 0.0f;
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

#endif // BREWPROCESS_H
