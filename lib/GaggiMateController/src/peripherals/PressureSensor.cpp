#include "PressureSensor.h"
#include "Wire.h"

PressureSensor::PressureSensor(ADSAdc *adc, float pressure_scale, float voltage_floor, float voltage_ceil, uint8_t channel)
    : _pressure_scale(pressure_scale), _adc(adc), _channel(channel),
      _filter(PRESSURE_KF_MEASUREMENT_NOISE, PRESSURE_KF_ESTIMATE_ERROR, PRESSURE_KF_PROCESS_NOISE) {
    _adc_floor = static_cast<int16_t>(voltage_floor / ADC_STEP);
    _pressure_adc_range = (voltage_ceil - voltage_floor) / ADC_STEP;
    _pressure_step = pressure_scale / _pressure_adc_range;
}

void PressureSensor::setup() {
    _adc->registerCallback([this](uint8_t channel, int reading) {
        if (channel == _channel) {
            onReading(reading);
        }
    });
}

void PressureSensor::onReading(int reading) {
    reading = reading - _adc_floor;
    const float pressure = static_cast<float>(reading) * _pressure_step;
    _raw_pressure = pressure;
    _raw_pressure = std::clamp(_raw_pressure, 0.0f, _pressure_scale);
    _pressure = std::clamp(_filter.updateEstimate(pressure), 0.0f, _pressure_scale);
    ESP_LOGV(LOG_TAG, "Channel %d, ADC Reading: %d, Pressure Reading: %f, Pressure Step: %f, Floor: %d", _channel, reading,
             _pressure, _pressure_step, _adc_floor);
}

void PressureSensor::setScale(float pressure_scale) {
    _pressure_scale = pressure_scale;
    _pressure_step = pressure_scale / _pressure_adc_range;
}
