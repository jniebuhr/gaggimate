#include "brew_target.h"

ProcessTarget chooseBrewTarget(bool isVolumetricProfile, bool userPrefersVolumetric, bool scaleHealthy) {
    return (isVolumetricProfile && userPrefersVolumetric && scaleHealthy) ? ProcessTarget::VOLUMETRIC : ProcessTarget::TIME;
}
