#include "SimplePump.h"

SimplePump::SimplePump(int pin, uint8_t pumpOn) : _pin(pin), _pumpOn(pumpOn), taskHandle(nullptr) {}

void SimplePump::setup() {
    pinMode(_pin, OUTPUT);
    digitalWrite(_pin, !_pumpOn);
    xTaskCreate(loopTask, "SimplePump::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void SimplePump::loop() {
    unsigned long currentMillis = millis();

    // Reset the cycle every PUMP_CYCLE_DURATION milliseconds
    if (currentMillis - lastCycleStart >= static_cast<long>(PUMP_CYCLE_TIME)) {
        lastCycleStart = currentMillis;
    }

    // Calculate the time the pump should stay on for
    unsigned long onTime = static_cast<long>(static_cast<int>(_setpoint) * PUMP_CYCLE_TIME / 100);

    // Determine the current step in the cycle
    unsigned long currentCycleDuration = (currentMillis - lastCycleStart);

    // Turn pump ON for the first `onSteps` steps and OFF for the remainder
    ESP_LOGV(LOG_TAG, "Switching to: %u", currentCycleDuration < onTime);
    digitalWrite(_pin, currentCycleDuration < onTime ? _pumpOn : !_pumpOn); // Relay on
}

void SimplePump::setPower(float setpoint) { _setpoint = setpoint; }

void SimplePump::loopTask(void *arg) {
    auto *pump = static_cast<SimplePump *>(arg);
    while (true) {
        pump->loop();
        vTaskDelay(PUMP_CYCLE_TIME / 100 / portTICK_PERIOD_MS);
    }
}
