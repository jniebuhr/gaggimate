#include "HeaterCoordinator.h"
#include <algorithm>

HeaterCoordinator::HeaterCoordinator(Heater *brew, Heater *steam, uint32_t handoverMs, bool enabled)
    : priorityEnabled(enabled), brew(brew), steam(steam) {
    interlock.setDelay(std::max(20u, handoverMs));
    brew->enableCoordination(true);
    steam->enableCoordination(!enabled);
}

bool HeaterCoordinator::setup() {
    if (xTaskCreate(loopTask, "HeaterCoordinator", configMINIMAL_STACK_SIZE * 3,
                    this, 2, &task) != pdPASS) {
        ESP_LOGE("HeaterCoordinator", "Could not start coordinator; both heaters inhibited");
        return false;
    }
    return true;
}

void HeaterCoordinator::loop() {
    // Reserve the brew autotuner's unheated phases as well as its heating phases.
    interlock.update(brew->isRequestingOn(), steam->isRequestingOn() && (!priorityEnabled || !brew->isAutotuning()), priorityEnabled,
        [this](unsigned channel, bool on) {
            return (channel == 0 ? brew : steam)->setCoordinatedState(on);
        }, []() { return static_cast<uint32_t>(millis()); });
}

void HeaterCoordinator::loopTask(void *arg) {
    auto *coordinator = static_cast<HeaterCoordinator *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        coordinator->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(10));
    }
}
