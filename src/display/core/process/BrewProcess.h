#ifndef BREWPROCESS_H
#define BREWPROCESS_H

#include <algorithm>
#include <display/core/constants.h>
#include <display/core/predictive.h>
#include <display/core/process/Process.h>
#include <display/models/profile.h>

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
    VolumetricRateCalculator volumetricRateCalculator{static_cast<double>(PREDICTIVE_TIME)};

    explicit BrewProcess(Profile profile, ProcessTarget target, double brewDelay = 0.0)
        : profile(profile), target(target), brewDelay(brewDelay) {
        currentPhase = profile.phases.at(phaseIndex);
        processStarted = millis();
        currentPhaseStarted = millis();
        phaseStartPressure = currentPhase.transition.adaptive ? currentPressure : 0;
        phaseStartFlow = currentPhase.transition.adaptive ? currentFlow : 0;
        computeEffectiveTargetsForCurrentPhase();
    }

    void updateVolume(double volume) override { // called even after the Process is no longer active
        currentVolume = volume;
        if (processPhase != ProcessPhase::FINISHED) { // only store measurements while active
            volumetricRateCalculator.addMeasurement(volume);
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
            double currentRate = volumetricRateCalculator.getRate();
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

    double getNewDelayTime() {
        double newDelay = brewDelay + volumetricRateCalculator.getOvershootAdjustMillis(double(getBrewVolume()), currentVolume);
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
        if (!isAdvancedPump())
            return 0.0f;
        const float startVal = phaseStartPressure;
        const float endVal = effectivePressure;
        const float a = transitionAlpha();
        return startVal + (endVal - startVal) * a;
    }

    float getPumpFlow() const {
        if (!isAdvancedPump())
            return 0.0f;
        const float startVal = phaseStartFlow;
        const float endVal = effectiveFlow;
        const float a = transitionAlpha();
        return startVal + (endVal - startVal) * a;
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
        while (isCurrentPhaseFinished() && processPhase == ProcessPhase::RUNNING) {
            previousPhaseFinished = millis();
            if (phaseIndex + 1 < profile.phases.size()) {
                waterPumped = 0.0f;
                phaseIndex++;
                Phase nextPhase = profile.phases.at(phaseIndex);
                phaseStartPressure = nextPhase.transition.adaptive ? currentPressure : getPumpPressure();
                phaseStartFlow = nextPhase.transition.adaptive ? currentFlow : getPumpFlow();
                currentPhase = nextPhase;
                currentPhaseStarted = millis();
                computeEffectiveTargetsForCurrentPhase();
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

  private:
    float phaseStartPressure = 0.0f;
    float phaseStartFlow = 0.0f;

    float effectivePressure = 0.0f;
    float effectiveFlow = 0.0f;

    static float easeLinear(float t) { return t; }
    static float easeIn(float t) { return t * t; }
    static float easeOut(float t) { return 1.0f - (1.0f - t) * (1.0f - t); }
    static float easeInOut(float t) { return (t < 0.5f) ? 2.0f * t * t : 1.0f - 2.0f * (1.0f - t) * (1.0f - t); }

    float applyEasing(float t, TransitionType type) const {
        if (t <= 0.0f)
            return 0.0f;
        if (t >= 1.0f)
            return 1.0f;
        switch (type) {
        case TransitionType::LINEAR:
            return easeLinear(t);
        case TransitionType::EASE_IN:
            return easeIn(t);
        case TransitionType::EASE_OUT:
            return easeOut(t);
        case TransitionType::EASE_IN_OUT:
            return easeInOut(t);
        case TransitionType::INSTANT:
        default:
            return 1.0f;
        }
    }

    void computeEffectiveTargetsForCurrentPhase() {
        if (currentPhase.pumpIsSimple) {
            effectivePressure = 0.0f;
            effectiveFlow = 0.0f;
            return;
        }

        // If the profile requests -1, use the *measured* value at the moment the phase starts.
        effectivePressure =
            (currentPhase.pumpAdvanced.pressure == -1.0f) ? phaseStartPressure : currentPhase.pumpAdvanced.pressure;
        effectiveFlow = (currentPhase.pumpAdvanced.flow == -1.0f) ? phaseStartFlow : currentPhase.pumpAdvanced.flow;
        if (currentPhase.pumpAdvanced.target == PumpTarget::PUMP_TARGET_FLOW) {
            phaseStartPressure = effectivePressure;
        } else {
            phaseStartFlow = effectiveFlow;
        }
    }

    float transitionAlpha() const {
        const float dur_s = currentPhase.transition.duration;
        if (currentPhase.transition.type == TransitionType::INSTANT || dur_s <= 0.0f) {
            return 1.0f;
        }
        const unsigned long elapsedMs = millis() - currentPhaseStarted;
        float t = float(elapsedMs) / (dur_s * 1000.0f);
        return applyEasing(t, currentPhase.transition.type);
    }
};

#endif // BREWPROCESS_H
