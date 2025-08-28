#pragma once
#ifndef STATIC_PROFILES_H
#define STATIC_PROFILES_H
#include <display/models/profile.h>
#include <display/core/Settings.h>
#include <algorithm>
inline Profile makeFlushProfile(const Settings &settings) {
    Profile p{.label = "Flush", .type = "standard", .temperature = 93};
    float d = static_cast<float>(settings.getFlushDuration());
    // Safety: ensure non-negative duration (old preference values might be invalid)
    d = std::max(0.0f, d);
    Phase phase{.name = "Flush",
                .phase = PhaseType::PHASE_TYPE_BREW,
                .valve = 1,
                .duration = d,
                .pumpIsSimple = true,
                .pumpSimple = 100,
                .temperature = 0.0f};
    p.phases.push_back(phase);
    return p;
}

#endif // STATIC_PROFILES_H
