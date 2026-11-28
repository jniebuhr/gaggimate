#ifndef LIVEBREWPROCESS_H
#define LIVEBREWPROCESS_H

#include <algorithm>
#include <cmath>
#include <display/core/constants.h>
#include <display/core/process/Process.h>

// A profile-independent manual brew process. The normal Controller pump path
// still owns the actual PumpControl/RelayControl commands; this object only
// stores the operator's bounded setpoints and provides the normal lifecycle and
// safety timeout hooks.
class LiveBrewProcess : public Process {
  public:
    LiveBrewProcess(float pressure, float flow) : pressureTarget(pressure), flowTarget(flow), started(millis()) {}

    bool isRelayActive() override { return isActive(); }
    bool isAltRelayActive() override { return false; }
    float getPumpValue() override { return 0.0f; }
    void updateVolume(double) override {}
    void progress() override {
        if (millis() - started >= BREW_SAFETY_DURATION_MS)
            active = false;
    }
    bool isActive() override { return active; }
    bool isComplete() override { return !active; }
    int getType() override { return MODE_BREW; }
    bool isLiveBrew() const override { return true; }

    void stop() { active = false; }
    void setSetpoints(float pressure, float flow) {
        pressureTarget = pressure;
        flowTarget = flow;
    }
    float getPressureTarget() const { return pressureTarget; }
    float getFlowTarget() const { return flowTarget; }
    unsigned long getStarted() const { return started; }

  private:
    bool active = true;
    float pressureTarget;
    float flowTarget;
    unsigned long started;
};

#endif // LIVEBREWPROCESS_H
