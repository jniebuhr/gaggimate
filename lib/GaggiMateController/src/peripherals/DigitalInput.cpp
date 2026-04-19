#include "DigitalInput.h"

// Single pin constructor
DigitalInput::DigitalInput(uint8_t pin, const input_callback_t &callback)
    : _pin1(pin), _singleCallback(callback) {}

// Dual pin constructor
DigitalInput::DigitalInput(uint8_t pin1, uint8_t pin2, const combined_callback_t &callback)
    : _pin1(pin1), _pin2(pin2), _combinedCallback(callback) {}

void DigitalInput::setup() {
    pinMode(_pin1, INPUT_PULLUP);
    if (_pin2 != 255) {
        pinMode(_pin2, INPUT_PULLUP);
    }
    xTaskCreate(loopTask, "DigitalInput::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DigitalInput::loopSingle() {
    uint8_t current = !digitalRead(_pin1);
    if (current != _lastState) {
        _lastState = current;
        _singleCallback(current); // active low — invert
    }
}

void DigitalInput::loopCombined() {
    uint8_t brew  = !digitalRead(_pin1); // active low
    uint8_t steam = !digitalRead(_pin2); // active low
    uint8_t current = (brew << 1) | steam;
    if (current != _lastState) {
        _lastState = current;
        _combinedCallback(current);
    }
}

void DigitalInput::loopTask(void *arg) {
    auto *input = static_cast<DigitalInput *>(arg);
    while (true) {
        if (input->_pin2 == 255) {
            input->loopSingle();
        } else {
            input->loopCombined();
        }
        vTaskDelay(INPUT_CHECK_INTERVAL_MS / portTICK_PERIOD_MS);
    }
}
