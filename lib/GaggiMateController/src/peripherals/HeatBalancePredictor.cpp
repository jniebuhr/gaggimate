#include "HeatBalancePredictor.h"
#include <algorithm>
#include <cmath>
#include <numeric>

void HeatBalancePredictor::configure(float watts, float fullPowerRate, float deadTimeSeconds, float inletTempC,
                                     float waterDeadTimeSeconds) {
    const bool valid = std::isfinite(watts) && std::isfinite(fullPowerRate) && std::isfinite(deadTimeSeconds) && watts > 0.0f &&
                       fullPowerRate > 0.0f && deadTimeSeconds > 0.0f;
    const float capacity = valid ? watts / fullPowerRate : 0.0f;
    const float delay = valid ? deadTimeSeconds : 0.0f;
    // Water's own delay when one is given, else the heater's.
    float waterDelay = delay;
    if (valid && std::isfinite(waterDeadTimeSeconds) && waterDeadTimeSeconds > 0.0f)
        waterDelay = waterDeadTimeSeconds;
    if (capacity == heatCapacity && delay == deadTime && waterDelay == waterDeadTime && watts == heaterWatts) {
        // Unchanged re-send keeps the in-flight window; so does a new inlet water temperature: it only changes how
        // future water is counted.
        inletTemp = inletTempC;
        return;
    }
    heaterWatts = valid ? watts : 0.0f;
    heatCapacity = capacity;
    deadTime = delay;
    waterDeadTime = waterDelay;
    inletTemp = inletTempC;
    // The standing loss is a property of the boiler, not of these parameters, so it survives a reconfigure.
    reset();
}

void HeatBalancePredictor::seedLoss(float savedWatts) {
    if (!isEnabled() || lossSeeded)
        return;
    const float watts =
        std::isfinite(savedWatts) && savedWatts > 0.0f ? std::min(savedWatts, heaterWatts) : DEFAULT_LOSS_FRACTION * heaterWatts;
    lossPerC = watts / LOSS_REFERENCE_DELTA_C;
    lossSeeded = true;
}

void HeatBalancePredictor::reset() {
    window.clear();
    windowTime = 0.0f;
    correction = 0.0f;
    lastFlow = 0.0f;
}

float HeatBalancePredictor::update(float dt, float duty, float flow, float measuredTemp, float setpoint) {
    if (!isEnabled() || !(dt > 0.0f) || !std::isfinite(measuredTemp)) {
        correction = 0.0f;
        lastFlow = 0.0f;
        return correction;
    }
    dt = std::min(dt, MAX_STEP_S);
    duty = std::min(std::max(duty, 0.0f), 1.0f);
    flow = std::isfinite(flow) && flow > 0.0f ? flow : 0.0f;

    const float heaterPower = heaterWatts * duty;
    const float waterPower = flow * WATER_SPECIFIC_HEAT * std::max(measuredTemp - inletTemp, 0.0f);
    // When the water stops the valve dumps the group's water into the drip tray: boiler water the flow didn't count.
    float waterJ = waterPower * dt;
    if (flow == 0.0f && lastFlow > 0.0f)
        waterJ += valveDumpMl * WATER_SPECIFIC_HEAT * std::max(measuredTemp - inletTemp, 0.0f);
    lastFlow = flow;

    // Standing losses: at rest near setpoint the heater power that holds temperature is the loss. Learning it
    // keeps the steady-state correction at zero, so the PID still settles the real sensor on setpoint.
    // Learned per degree above the room, so a value learned at brew temperature also holds at steam temperature.
    const float aboveRoom = measuredTemp - AMBIENT_C;
    if (flow == 0.0f && setpoint > 0.0f && std::fabs(measuredTemp - setpoint) < LOSS_LEARN_BAND && aboveRoom > 10.0f) {
        lossPerC += (heaterPower / aboveRoom - lossPerC) * dt / (LOSS_LEARN_TAU + dt);
    }
    const float lossWatts = lossPerC * std::max(aboveRoom, 0.0f);

    window.push_back({dt, (heaterPower - lossWatts) * dt / heatCapacity, waterJ / heatCapacity});
    windowTime += dt;
    // Steps older than both delays have reached the sensor; they are in measuredTemp already.
    const float longest = std::max(deadTime, waterDeadTime);
    while (!window.empty() && windowTime - window.front().dt >= longest) {
        windowTime -= window.front().dt;
        window.pop_front();
    }
    // Sum, newest first, what each path hasn't delivered to the sensor yet (re-summed each step, so float drift can't
    // build up over hours). Each step counts by the share of it still inside that path's delay: all of it while the
    // whole step is, part of the one straddling the edge (a 12.5 s delay over 1 s steps counts 12.5 steps, not 13).
    float pending = 0.0f;
    float since = 0.0f;
    const auto shareInside = [](float delay, float since, float dt) {
        return std::min(std::max((delay - since) / dt, 0.0f), 1.0f);
    };
    for (auto it = window.rbegin(); it != window.rend(); ++it) {
        pending += shareInside(deadTime, since, it->dt) * it->heat;
        pending -= shareInside(waterDeadTime, since, it->dt) * it->water;
        since += it->dt;
    }

    correction = std::min(std::max(pending, -MAX_CORRECTION), MAX_CORRECTION);

    return correction;
}
