#pragma once
#ifndef BREW_TARGET_H
#define BREW_TARGET_H

#include "process/Process.h"

// Selects the ProcessTarget for a brew based on three independent inputs:
//   isVolumetricProfile    - the active profile defines a weight target
//   userPrefersVolumetric  - the user's settings.isVolumetricTarget() preference
//   scaleHealthy           - isVolumetricAvailable() (e.g. paired BLE scale reporting)
// VOLUMETRIC requires all three; otherwise TIME.
ProcessTarget chooseBrewTarget(bool isVolumetricProfile, bool userPrefersVolumetric, bool scaleHealthy);

#endif // BREW_TARGET_H
