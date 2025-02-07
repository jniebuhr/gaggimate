#ifndef PROCESS_H
#define PROCESS_H

#include "constants.h"
#include <deque>
#include <numeric>

constexpr int PREDICTIVE_MEASUREMENTS = 2; // last n measurements used for prediction
//constexpr double PREDICTIVE_TIME_MS = 1000.0;

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

enum class BrewPhase { INFUSION_PRESSURIZE, INFUSION_PUMP, INFUSION_BLOOM, BREW_PRESSURIZE, BREW_PUMP, FINISHED };

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
    double currentVolume = 0;//most recent volume pushed
    double currentVolumePerSecond =0;
    std::vector<double> measurements;
    std::vector<double> measurementTimes;

    explicit BrewProcess(ProcessTarget target = ProcessTarget::TIME, int pressurizeTime = 0, int infusionPumpTime = 0,
                         int infusionBloomTime = 0, int brewTime = 0, int brewVolume = 0, double brewDelay=0.0)
        : target(target), infusionPumpTime(infusionPumpTime), infusionBloomTime(infusionBloomTime), brewTime(brewTime),
          brewVolume(brewVolume), brewPressurize(pressurizeTime),brewDelay(brewDelay) {
        if (infusionBloomTime == 0 || infusionPumpTime == 0) {
            phase = BrewPhase::BREW_PRESSURIZE;
        } else if (pressurizeTime == 0) {
            phase = BrewPhase::INFUSION_PUMP;
        }
        currentPhaseStarted = millis();
    }

    void updateVolume(double new_volume) override {
        currentVolume = new_volume;
        measurements.emplace_back(currentVolume);
        measurementTimes.emplace_back(millis());
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
        default:
            return 0;
        }
    }

    double volumePerSecond() const {

        if (measurements.size()<PREDICTIVE_MEASUREMENTS) return 0.0;

        double v_mean = std::accumulate(measurements.begin(), measurements.end(), 0.0)/measurements.size();
        double t_mean = std::accumulate(measurementTimes.begin(), measurementTimes.end(), 0.0)/measurementTimes.size();

        double tdev2 = 0.0;
        double tdev_vdev = 0.0;
        for (size_t i=measurements.size()-1; i>= measurements.size()-PREDICTIVE_MEASUREMENTS;i--) {
            tdev_vdev += (measurementTimes[i]-t_mean)*(measurements[i]-v_mean);
            tdev2 += pow(measurementTimes[i]-t_mean,2.0);
        }
        double volumePerMilliSecond=tdev_vdev/tdev2;//the slope of the linear best fit

        return volumePerMilliSecond ? volumePerMilliSecond * 1000.0 : 0.0; // return 0 if it is not positive
    }

    bool isCurrentPhaseFinished() {
        if (phase == BrewPhase::BREW_PUMP && target == ProcessTarget::VOLUMETRIC) {
            if (millis() - currentPhaseStarted > BREW_SAFETY_DURATION_MS) {
                return true;
            }
            currentVolumePerSecond = volumePerSecond();//stored for determination of the delay
            const double predictedAddedVolume = currentVolumePerSecond/ 1000.0 * brewDelay;
            return currentVolume + predictedAddedVolume >= brewVolume;
        }
        if (phase != BrewPhase::FINISHED) {
            return millis() - currentPhaseStarted > getPhaseDuration();
        }
        return true;
    }

    double getNewDelayTime(double finalVolume) const {
        double overshoot = finalVolume - double(brewVolume);
        double overshootTime=overshoot*1000/currentVolumePerSecond;//the amount of brewDelay corresponding to the overshoot
        return brewDelay-overshootTime; //decrease brewDelay and return
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
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL





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
    int time;
    int volume;
    double grindDelay;
    unsigned long started;
    std::deque<double> measurements;

    double currentVolume = 0;
    double lastVolume = 0;

    explicit GrindProcess(ProcessTarget target = ProcessTarget::TIME, int time = 0, int volume = 0, double grindDelay = 0)
        : target(target), time(time), volume(volume), grindDelay(grindDelay) {
        started = millis();
    }

    double volumePerSecond() const {
        double sum = 0.0;
        for (const auto n : measurements) {
            sum += n;
        }
        return sum / static_cast<double>(measurements.size()) * (1000.0 / static_cast<double>(PROGRESS_INTERVAL));
    }

    void updateVolume(double volume) override { currentVolume = volume; };

    bool isRelayActive() override { return false; }

    bool isAltRelayActive() override { return isActive(); }

    float getPumpValue() override { return 0.f; }

    void progress() override {
        // Progress should be called around every 100ms, as defined in PROGRESS_INTERVAL
        double diff = currentVolume - lastVolume;
        if (diff < 0.0) {
            diff = 0.0;
        }
        lastVolume = currentVolume;
        measurements.push_back(diff);
        while (measurements.size() > PREDICTIVE_MEASUREMENTS) {
            measurements.pop_front();
        }
    }

    bool isActive() override {
        if (target == ProcessTarget::TIME) {
            return millis() - started < time;
        }
        const double predictiveFactor = volumePerSecond() / 1000.0 * grindDelay;
        return currentVolume + predictiveFactor < volume;
    }

    int getType() override { return MODE_GRIND; }
};

#endif // PROCESS_H
