#include "PressureSensor.h"
#include "Wire.h"

PressureSensor::PressureSensor(ADSAdc *adc, PressureControlRate controlRate, float pressure_scale,
                               float voltage_floor, float voltage_ceil, uint8_t channel)
    : _sampleTime(pressureControlPeriodS(controlRate)), _pressure_scale(pressure_scale), _adc(adc), _channel(channel),
      _filter(_sampleTime, PRESSURE_KF_MEASUREMENT_NOISE, PRESSURE_KF_ACCEL_NOISE, PRESSURE_KF_RATE_LEAK) {
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
    portENTER_CRITICAL(&_mux);
    _raw_pressure = std::clamp(pressure, 0.0f, _pressure_scale);
    _sum += _raw_pressure;
    ++_count;
    portEXIT_CRITICAL(&_mux);
}

bool PressureSensor::consumeAverage() {
    portENTER_CRITICAL(&_mux);
    const float sum = _sum;
    const uint32_t count = _count;
    _sum = 0;
    _count = 0;
    portEXIT_CRITICAL(&_mux);
    if (!count) return false;
    const int64_t now = esp_timer_get_time();
    if (_lastWindowUs) _sampleTime = (now - _lastWindowUs) / 1000000.0f;
    _lastWindowUs = now;
    _averagedPressure = sum / count;
    const float dt = std::clamp(_sampleTime, 0.0005f, 0.1f);
    _filter.setSampleTime(dt);
    // Preserve the supplied patch's time-scaled rate leakage.
    _filter.setRateLeak(powf(PRESSURE_KF_RATE_LEAK, dt / 0.030f));
    _pressure = std::clamp(_filter.updateEstimate(_averagedPressure), 0.0f, _pressure_scale);
    return true;
}

void PressureSensor::setScale(float pressure_scale) {
    _pressure_scale = pressure_scale;
    _pressure_step = pressure_scale / _pressure_adc_range;
}
