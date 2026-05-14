#ifndef MANUALPROCESS_H
#define MANUALPROCESS_H

#include <display/core/constants.h>
#include <display/core/process/BrewProcess.h>

class ManualProcess : public Process {
  public:
    unsigned long started = 0;
    unsigned long finished = 0;
    int targetType = DEFAULT_MANUAL_TARGET_TYPE;
    float pressure = DEFAULT_MANUAL_PRESSURE;
    float flow = DEFAULT_MANUAL_FLOW;
    int temperature = DEFAULT_MANUAL_TEMPERATURE;
    ProcessPhase processPhase = ProcessPhase::RUNNING;

    ManualProcess(int targetType, float pressure, float flow, int temperature)
        : targetType(targetType == MANUAL_TARGET_FLOW ? MANUAL_TARGET_FLOW : MANUAL_TARGET_PRESSURE), pressure(pressure),
          flow(flow), temperature(temperature) {
        started = millis();
    }

    bool isRelayActive() override { return isActive(); }
    bool isAltRelayActive() override { return false; }
    float getPumpValue() override { return isActive() ? 100.0f : 0.0f; }
    void progress() override {
        if (processPhase == ProcessPhase::RUNNING && millis() - started > BREW_SAFETY_DURATION_MS) {
            processPhase = ProcessPhase::FINISHED;
            finished = millis();
        }
    }
    bool isActive() override { return processPhase == ProcessPhase::RUNNING; }
    bool isComplete() override { return processPhase == ProcessPhase::FINISHED; }
    int getType() override { return MODE_MANUAL; }
    void updateVolume(double volume) override {}

    bool isPressureTarget() const { return targetType != MANUAL_TARGET_FLOW; }
    PumpTarget getPumpTarget() const {
        return isPressureTarget() ? PumpTarget::PUMP_TARGET_PRESSURE : PumpTarget::PUMP_TARGET_FLOW;
    }
    float getPumpPressure() const { return isActive() ? pressure : 0.0f; }
    float getPumpFlow() const { return isActive() ? flow : 0.0f; }
    int getTemperature() const { return temperature; }

    void updateTargets(int nextTargetType, float nextPressure, float nextFlow, int nextTemperature) {
        targetType = nextTargetType == MANUAL_TARGET_FLOW ? MANUAL_TARGET_FLOW : MANUAL_TARGET_PRESSURE;
        pressure = nextPressure;
        flow = nextFlow;
        temperature = nextTemperature;
    }
};

#endif // MANUALPROCESS_H
