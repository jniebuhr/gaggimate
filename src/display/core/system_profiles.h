#pragma once
#ifndef SYSTEM_PROFILES_H
#define SYSTEM_PROFILES_H
#include <display/models/profile.h>

// Seeds for the system profiles; only written when missing, so user edits are kept.

inline Phase systemPhase(const char *name, PhaseType type, int valve, float duration, int pump, float pumpedTarget = 0.0f) {
    Phase phase{};
    phase.name = name;
    phase.phase = type;
    phase.valve = valve;
    phase.duration = duration;
    phase.pumpIsSimple = true;
    phase.pumpSimple = pump;
    phase.transition.type = TransitionType::INSTANT;
    if (pumpedTarget > 0.0f)
        phase.targets.push_back(Target{TargetType::TARGET_TYPE_PUMPED, TargetOperator::GTE, pumpedTarget});
    return phase;
}

inline Profile makeBackflushProfile(const char *id) {
    Profile profile{};
    profile.id = id;
    profile.label = "[Utility] Backflush";
    profile.type = "standard";
    profile.utility = true;
    profile.temperature = 93;
    for (int i = 0; i < 5; i++) {
        profile.phases.push_back(systemPhase("Pressurize", PhaseType::PHASE_TYPE_BREW, 1, 10.0f, 100));
        if (i < 4)
            profile.phases.push_back(systemPhase("Depressurize", PhaseType::PHASE_TYPE_BREW, 0, 10.0f, 0));
    }
    return profile;
}

// Wait phases stay below the 300 s brew safety limit; three of them make up the 10 minute soak.
inline Profile makeDescalingProfile(const char *id) {
    Profile profile{};
    profile.id = id;
    profile.label = "[Utility] Descale";
    profile.type = "pro";
    profile.utility = true;
    profile.temperature = 0;
    profile.phases.push_back(systemPhase("300ml Steam Flush", PhaseType::PHASE_TYPE_BREW, 0, 40.0f, 100, 300.0f));
    profile.phases.push_back(systemPhase("Wait 1 of 3", PhaseType::PHASE_TYPE_PREINFUSION, 0, 200.0f, 0));
    profile.phases.push_back(systemPhase("Wait 2 of 3", PhaseType::PHASE_TYPE_PREINFUSION, 0, 200.0f, 0));
    profile.phases.push_back(systemPhase("Wait 3 of 3", PhaseType::PHASE_TYPE_PREINFUSION, 0, 200.0f, 0));
    profile.phases.push_back(systemPhase("300ml Steam Flush", PhaseType::PHASE_TYPE_BREW, 0, 40.0f, 100, 300.0f));
    profile.phases.push_back(systemPhase("Rinse and Refill", PhaseType::PHASE_TYPE_PREINFUSION, 0, 120.0f, 0));
    profile.phases.push_back(systemPhase("1lt Flush", PhaseType::PHASE_TYPE_BREW, 0, 120.0f, 100, 1000.0f));
    return profile;
}

#endif // SYSTEM_PROFILES_H
