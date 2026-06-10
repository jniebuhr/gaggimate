#include "PressureSensor.h"
#include "Wire.h"

<<<<<<< Updated upstream
PressureSensor::PressureSensor(ADSAdc *adc, float pressure_scale, float voltage_floor, float voltage_ceil, uint8_t channel)
    : _pressure_scale(pressure_scale), _adc(adc), _channel(channel) {
=======
PressureSensor::PressureSensor(uint8_t sda_pin, uint8_t scl_pin, const pressure_callback_t &callback, float pressure_scale,
                               float voltage_floor, float voltage_ceil)
    : _sda_pin(sda_pin), _scl_pin(scl_pin), _pressure_scale(pressure_scale),
      _filter(PRESSURE_KF_MEASUREMENT_NOISE, PRESSURE_KF_ESTIMATE_ERROR, PRESSURE_KF_PROCESS_NOISE), _callback(callback),
      taskHandle(nullptr) {
>>>>>>> Stashed changes
    _adc_floor = static_cast<int16_t>(voltage_floor / ADC_STEP);
    _pressure_adc_range = (voltage_ceil - voltage_floor) / ADC_STEP;
    _pressure_step = pressure_scale / _pressure_adc_range;
}

void PressureSensor::setup() {
    xTaskCreate(loopTask, "PressureSensor::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void PressureSensor::loop() {
<<<<<<< Updated upstream
    int reading = _adc->getValue(_channel);
    reading = reading - _adc_floor;
    const float pressure = static_cast<float>(reading) * _pressure_step;
    _raw_pressure = pressure;
    _pressure = 0.1f * pressure + 0.9f * _pressure;
    _raw_pressure = std::clamp(_raw_pressure, 0.0f, _pressure_scale);
    _pressure = std::clamp(_pressure, 0.0f, _pressure_scale);
    ESP_LOGV(LOG_TAG, "Channel %d, ADC Reading: %d, Pressure Reading: %f, Pressure Step: %f, Floor: %d", _channel, reading,
             _pressure, _pressure_step, _adc_floor);
=======
    if (ads->isConnected()) {
        int16_t reading = ads->readADC();
        reading = reading - _adc_floor;
        float pressure = reading * _pressure_step;
        _raw_pressure = std::clamp(pressure, 0.0f, _pressure_scale);
        _pressure = std::clamp(_filter.updateEstimate(pressure), 0.0f, _pressure_scale);
        ESP_LOGV(LOG_TAG, "ADC Reading: %d, Pressure Reading: %f, Pressure Step: %f, Floor: %d", reading, _pressure,
                 _pressure_step, _adc_floor);
        _callback(_pressure);
    }
>>>>>>> Stashed changes
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
