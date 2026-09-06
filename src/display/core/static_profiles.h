#pragma once
#ifndef STATIC_PROFILES_H
#define STATIC_PROFILES_H
#include <display/core/constants.h>
#include <display/models/profile.h>

// Phase 0 duration is a placeholder: Controller::onFlush() sets it from the flush duration setting (GM-201).
Profile FLUSH_PROFILE{.label = "Flush",
                      .type = "standard",
                      .utility = true,
                      .temperature = 93,
                      .phases = {Phase{.name = "Flush",
                                       .phase = PhaseType::PHASE_TYPE_BREW,
                                       .valve = 1,
                                       .duration = DEFAULT_FLUSH_DURATION_S,
                                       .pumpIsSimple = true,
                                       .pumpSimple = 100},
                                 Phase{.name = "Drain",
                                       .phase = PhaseType::PHASE_TYPE_BREW,
                                       .valve = 1,
                                       .duration = FLUSH_DRAIN_DURATION_S,
                                       .pumpIsSimple = true,
                                       .pumpSimple = 0}}};

#endif // STATIC_PROFILES_H
