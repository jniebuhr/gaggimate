#include "DigitalInput.h"

DigitalInput::DigitalInput(uint8_t pin, const input_callback_t &callback) : _pin(pin), _callback(callback) {}

void DigitalInput::setup() {
    pinMode(_pin, INPUT_PULLUP);
    xTaskCreate(loopTask, "DigitalInput::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DigitalInput::loop() {
    if (digitalRead(_pin) != _last_state) {
        _last_state = digitalRead(_pin);
        _callback(!_last_state);
    }
}

void DigitalInput::loopTask(void *arg) {
    auto *input = static_cast<DigitalInput *>(arg);
    while (true) {
        input->loop();
        vTaskDelay(INPUT_CHECK_INTERVAL_MS / portTICK_PERIOD_MS);
    }
}
