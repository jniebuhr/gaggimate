#include "DigitalInput.h"

DigitalInput::DigitalInput(uint8_t pin, const input_callback_t &callback, const int debounce_count)
    : _pin(pin), _debounce_count(debounce_count), _callback(callback) {}

void DigitalInput::setup() {
    pinMode(_pin, INPUT_PULLUP);
    xTaskCreate(loopTask, "DigitalInput::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DigitalInput::loop() {
    if (const int state = digitalRead(_pin); state != _last_state) {
        _stable_counter = 1;
        _last_state = state;
        ESP_LOGI("DigitalInput", "Volatile state changed: %d, counter: %d", !_last_state, _stable_counter);
    } else {
        _stable_counter++;
    }
    if (_stable_counter >= _debounce_count && _current_state != _last_state) {
        _current_state = _last_state;
        _callback(!_current_state);
        ESP_LOGI("DigitalInput", "Stable State changed: %d, counter: %d", !_current_state, _stable_counter);
    }
    _stable_counter = min(_stable_counter, _debounce_count);
}

void DigitalInput::loopTask(void *arg) {
    auto *input = static_cast<DigitalInput *>(arg);
    while (true) {
        input->loop();
        vTaskDelay(INPUT_CHECK_INTERVAL_MS / portTICK_PERIOD_MS);
    }
}
