#include "MockController.h"

#include <Arduino.h>
#include <algorithm>
#include <cmath>

void MockController::begin() {
    active = true;
    lastUpdateMs = millis();
}

void MockController::setBoiler(const BoilerCommand &c) {
    if (c.mode == BoilerControlMode::Temperature)
        targetTemp = c.setpoint;
}

void MockController::setPump(const PumpCommand &c) {
    pumpMode = c.mode;
    pumpPower = c.power;
    targetPressure = c.pressure;
    targetFlow = c.flow;
}

void MockController::setRelay(const RelayCommand &c) {
    if (c.index == 0)
        brewValveOpen = c.open;
}

void MockController::update() {
    if (!active)
        return;
    uint32_t now = millis();
    float dt = (now - lastUpdateMs) / 1000.0f;
    if (dt <= 0.0f)
        return;
    if (dt > 0.5f)
        dt = 0.5f; // clamp scheduling gaps so the model can't jump
    lastUpdateMs = now;

    // First-order approach to the boiler setpoint (or back to ambient when off).
    const float tau = targetTemp > 0.0f ? 12.0f : 90.0f;
    const float dest = targetTemp > 0.0f ? targetTemp : ambient;
    temperature += (dest - temperature) * (1.0f - expf(-dt / tau));

    // The pump is "active" when the display asks for any drive.
    const bool pumpActive = pumpPower > 1.0f || targetPressure > 0.1f || targetFlow > 0.1f;
    float pDest = 0.0f, fDest = 0.0f;
    if (pumpActive) {
        if (pumpMode == PumpControlMode::Pressure) {
            pDest = targetPressure;
            fDest = std::max(0.5f, 4.0f - targetPressure * 0.3f);
        } else if (pumpMode == PumpControlMode::Flow) {
            fDest = targetFlow;
            pDest = std::min(11.0f, targetFlow * 4.0f);
        } else { // power
            pDest = pumpPower / 10.0f;
            fDest = std::max(0.3f, pumpPower / 40.0f);
        }
    }
    pressure += (pDest - pressure) * (1.0f - expf(-dt / 0.4f));
    flow += (fDest - flow) * (1.0f - expf(-dt / 0.4f));

    // Water reaches the cup (scale) only with the brew valve open.
    if (brewValveOpen && flow > 0.05f)
        weight += flow * dt; // ~1 ml ≈ 1 g

    if (now - lastSensorMs >= 100) {
        lastSensorMs = now;
        const float puckResistance = flow > 0.05f ? pressure / flow : 0.0f;
        if (onSensor)
            onSensor(temperature, pressure, flow, flow, puckResistance);
        if (onVolumetric)
            onVolumetric(weight);
    }
    if (now - lastTofMs >= 1000) {
        lastTofMs = now;
        if (onTof)
            onTof(40); // mm to the water surface — a comfortably full tank
    }
}
