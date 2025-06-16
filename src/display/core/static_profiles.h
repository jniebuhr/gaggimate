#pragma once
#ifndef STATIC_PROFILES_H
#define STATIC_PROFILES_H
#include <display/models/profile.h>

Profile FLUSH_PROFILE{.label = "Flush",
                      .type = "standard",
                      .temperature = 93,
                      .phases = {Phase{.name = "Flush",
                                       .phase = PhaseType::PHASE_TYPE_BREW,
                                       .valve = 1,
                                       .duration = 5,
                                       .pumpIsSimple = true,
                                       .pumpSimple = 100}}};

#endif // STATIC_PROFILES_H
