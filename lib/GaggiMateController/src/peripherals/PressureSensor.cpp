#include "PressureSensor.h"
#include "Wire.h"

PressureSensor::PressureSensor(ADSAdc *adc, float pressure_scale, float voltage_floor, float voltage_ceil, uint8_t channel)
    : _pressure_scale(pressure_scale), _adc(adc), _channel(channel) {
    _adc_floor = static_cast<int16_t>(voltage_floor / ADC_STEP);
    _pressure_adc_range = (voltage_ceil - voltage_floor) / ADC_STEP;
    _pressure_step = pressure_scale / _pressure_adc_range;
}

void PressureSensor::setup() {
    xTaskCreate(loopTask, "PressureSensor::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void PressureSensor::loop() {
    int reading = _adc->getValue(_channel);
    reading = reading - _adc_floor;
    const float pressure = static_cast<float>(reading) * _pressure_step;
    _raw_pressure = pressure;
    _pressure = 0.1f * pressure + 0.9f * _pressure;
    _raw_pressure = std::clamp(_raw_pressure, 0.0f, _pressure_scale);
    _pressure = std::clamp(_pressure, 0.0f, _pressure_scale);
    ESP_LOGV(LOG_TAG, "Channel %d, ADC Reading: %d, Pressure Reading: %f, Pressure Step: %f, Floor: %d", _channel, reading,
             _pressure, _pressure_step, _adc_floor);
}

void PressureSensor::setScale(float pressure_scale) {
    _pressure_scale = pressure_scale;
    _pressure_step = pressure_scale / _pressure_adc_range;
}

[[noreturn]] void PressureSensor::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *sensor = static_cast<PressureSensor *>(arg);
    while (true) {
        sensor->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS));
    }
}
