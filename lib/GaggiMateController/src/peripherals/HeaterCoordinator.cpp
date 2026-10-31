#include "HeaterCoordinator.h"
#include <Arduino.h>
#include <algorithm>

HeaterCoordinator::HeaterCoordinator(Heater *brew, Heater *steam) : heaters{brew, steam} {
    offAt[0] = offAt[1] = millis() - MAX_HANDOVER_MS;
    brew->setCoordinator(this);
    steam->setCoordinator(this);
}

void HeaterCoordinator::configure(bool heaterCoordinationEnabled, uint32_t handoverMs) {
    std::lock_guard<std::mutex> lock(mutex);
    this->heaterCoordinationEnabled = heaterCoordinationEnabled;
    this->handoverMs = std::clamp(handoverMs, MIN_HANDOVER_MS, MAX_HANDOVER_MS);
}

void HeaterCoordinator::request(Heater *heater, bool on) {
    std::lock_guard<std::mutex> lock(mutex);
    const int channel = heater == heaters[0] ? 0 : 1;
    const int other = 1 - channel;
    const uint32_t now = millis();
    wanted[channel] = on;
    if (!on || !heaterCoordinationEnabled) {
        set(channel, on, now);
        return;
    }
    // Brew leads unless steam is autotuning; an autotuning heater keeps the lead for the whole run so handovers don't skew it.
    const int lead = heaters[1]->isAutotuning() ? 1 : 0;
    if (channel == lead || wanted[lead] || heaters[lead]->isAutotuning()) {
        set(1 - lead, false, now);
        if (channel != lead)
            return;
    }
    // The other SSR must have been off for the handover gap before this one may switch on.
    if (!active[channel] && (active[other] || now - offAt[other] < handoverMs))
        return;
    set(channel, true, now);
}

void HeaterCoordinator::set(int channel, bool on, uint32_t now) {
    if (active[channel] && !on)
        offAt[channel] = now;
    active[channel] = on;
    heaters[channel]->writeOutput(on);
}
