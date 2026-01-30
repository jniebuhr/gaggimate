// FlowEstimator.cpp
#include "FlowEstimator.h"

#include <algorithm>
#include <cmath>

FlowEstimator::FlowEstimator(float dt) : _dt(dt) {}

void FlowEstimator::lowPass(float &state, float input, float cutoff, float dt) {
    // First-order low-pass filter.
    float alpha = dt / (dt + 1.0f / (2.0f * static_cast<float>(M_PI) * cutoff));
    state += alpha * (input - state);
}

void FlowEstimator::update(float pumpFlowMlPerS, float pressureBar, float pressureDerivativeBarPerS, bool valveOpen) {
    // Estimate flow through the puck using compliance and pressure slope.
    if (!valveOpen || pressureBar < 0.5f) {
        _filteredFlow = 0.0f;
        return;
    }

    pressureDerivativeBarPerS = std::clamp(pressureDerivativeBarPerS, -20.0f, 20.0f);

    float rawFlow = pumpFlowMlPerS - _compliance * pressureDerivativeBarPerS;
    rawFlow = std::max(0.0f, rawFlow);

    lowPass(_filteredFlow, rawFlow, _filterCutoff, _dt);
}
