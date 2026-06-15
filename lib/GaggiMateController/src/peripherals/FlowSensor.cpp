#include "FlowSensor.h"

FlowSensor *FlowSensor::_instance = nullptr;

void FlowSensor::onInterrupt() { _instance->addValue(1); }

FlowSensor::FlowSensor(uint8_t pin, flow_amount_callback_t callback) : _pin(pin), _callback(callback) { _instance = this; }

void FlowSensor::setup() {
    pinMode(_pin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(_pin), FlowSensor::onInterrupt, FALLING);
    xTaskCreate(loopTask, "FlowSensor::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void FlowSensor::loop() {
    _callback(static_cast<float>(_ticks) * ML_PER_PULSE);
    int intervalTicks = _ticks - _lastRunTicks;
    if (intervalTicks < 0) {
        intervalTicks = 0;
    }
    float intervalVolume = intervalTicks * ML_PER_PULSE;
    float flow = intervalVolume * 10.0f;
    _lastRunTicks = _ticks;
    _currentFlow = flow * 0.1f + _currentFlow * 0.9f;
    ESP_LOGV("FlowSensor", "Interval Volume: %.2f, Interval Ticks: %d, Interval Flow: %.2f, Flow: %.2f", intervalVolume,
             intervalTicks, flow, _currentFlow);
}

void FlowSensor::tare() { updateValue(0.0f); }

void FlowSensor::updateValue(int ticks) {
    ESP_LOGV("FlowSensor", "Updating ticks: %d", ticks);
    _ticks = ticks;
}

void FlowSensor::addValue(int ticks) { updateValue(_ticks + ticks); }

float FlowSensor::getFlow() const { return _currentFlow; }

void FlowSensor::loopTask(void *arg) {
    auto *sensor = static_cast<FlowSensor *>(arg);
    while (true) {
        sensor->loop();
        vTaskDelay(100 / portTICK_PERIOD_MS);
    }
}
