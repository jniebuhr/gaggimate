#pragma once
#ifndef STATIC_PROFILES_H
#define STATIC_PROFILES_H
#include <display/models/profile.h>
#include <display/core/Settings.h>
inline Profile makeFlushProfile(const Settings &settings) {
    Profile p{.label = "Flush", .type = "standard", .temperature = 93};
    Phase phase{.name = "Flush",
                .phase = PhaseType::PHASE_TYPE_BREW,
                .valve = 1,
                .duration = static_cast<float>(settings.getFlushDuration()),
                .pumpIsSimple = true,
                .pumpSimple = 100,
                .temperature = 0.0f};
    p.phases.push_back(phase);
    return p;
}

#endif // STATIC_PROFILES_H
