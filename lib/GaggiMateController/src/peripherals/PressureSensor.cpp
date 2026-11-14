#include "PressureSensor.h"
#include "Wire.h"

PressureSensor::PressureSensor(ADSAdc *adc, PressureControlRate controlRate, float pressure_scale, float voltage_floor,
                               float voltage_ceil, uint8_t channel)
    : _sampleTime(pressureControlPeriodS(controlRate)), _pressure_scale(pressure_scale), _adc(adc), _channel(channel),
      _filter(_sampleTime, PRESSURE_KF_MEASUREMENT_NOISE, PRESSURE_KF_ACCEL_NOISE, PRESSURE_KF_RATE_LEAK) {
    _adc_floor = static_cast<int16_t>(voltage_floor / ADC_STEP);
    _adc_fault_low = static_cast<int16_t>(PRESSURE_FAULT_VOLTAGE_LOW / ADC_STEP);
    _adc_fault_high = static_cast<int16_t>(PRESSURE_FAULT_VOLTAGE_HIGH / ADC_STEP);
    _pressure_adc_range = (voltage_ceil - voltage_floor) / ADC_STEP;
    _pressure_step = pressure_scale / _pressure_adc_range;
}

void PressureSensor::setup() {
    _lastValidMs = millis(); // give the ADC time to deliver its first samples
    _adc->registerCallback([this](uint8_t channel, int reading) {
        if (channel == _channel) {
            onReading(reading);
        }
    });
}

void PressureSensor::onReading(int reading) {
    if (reading > _adc_fault_low && reading < _adc_fault_high)
        _lastValidMs = millis();
    const float voltage = static_cast<float>(reading) * ADC_STEP;
    reading = reading - _adc_floor;
    const float pressure = static_cast<float>(reading) * _pressure_step;
    portENTER_CRITICAL(&_mux);
    _raw_pressure = std::clamp(pressure, 0.0f, _pressure_scale);
    _sum += _raw_pressure;
    _voltageSum += voltage;
    ++_count;
    portEXIT_CRITICAL(&_mux);
}

bool PressureSensor::consumeAverage() {
    portENTER_CRITICAL(&_mux);
    const float sum = _sum;
    const float voltageSum = _voltageSum;
    const uint32_t count = _count;
    _sum = 0;
    _voltageSum = 0;
    _count = 0;
    portEXIT_CRITICAL(&_mux);
    if (!count)
        return false;
    const int64_t now = esp_timer_get_time();
    if (_lastWindowUs)
        _sampleTime = (now - _lastWindowUs) / 1000000.0f;
    _lastWindowUs = now;
    _averagedPressure = sum / count;
    _averagedVoltage = voltageSum / count;
    const float dt = std::clamp(_sampleTime, 0.0005f, 0.1f);
    _filter.setSampleTime(dt);
    // Preserve the supplied patch's time-scaled rate leakage.
    _filter.setRateLeak(powf(PRESSURE_KF_RATE_LEAK, dt / 0.030f));
    _pressure = std::clamp(_filter.updateEstimate(_averagedPressure), 0.0f, _pressure_scale);
    return true;
}

void PressureSensor::trackPumpRun(float pumpPower, bool fresh) {
    if (pumpPower < PRESSURE_STUCK_PUMP_POWER) {
        // Judge a finished run: the unclamped voltage mean must have moved while the pump ran.
        if (_pumpRunning && _blocks >= 2 && millis() - _pumpRunStartMs >= PRESSURE_STUCK_MIN_RUN_MS && !_stuck &&
            _swingMax - _swingMin < PRESSURE_STUCK_MIN_SWING_V) {
            _stuck = true;
            ESP_LOGW(LOG_TAG, "Pressure reading did not respond to the pump (%.3f V swing)", _swingMax - _swingMin);
        }
        _pumpRunning = false;
        return;
    }
    if (!_pumpRunning) {
        _pumpRunning = true;
        _pumpRunStartMs = millis();
        _blockSum = 0.0f;
        _blockCount = 0;
        _blocks = 0;
    }
    if (!fresh)
        return;
    _blockSum += _averagedVoltage;
    if (++_blockCount < PRESSURE_STUCK_BLOCK_SAMPLES)
        return;
    const float mean = _blockSum / _blockCount;
    _swingMin = _blocks ? std::min(_swingMin, mean) : mean;
    _swingMax = _blocks ? std::max(_swingMax, mean) : mean;
    ++_blocks;
    _blockSum = 0.0f;
    _blockCount = 0;
    if (_stuck && _swingMax - _swingMin >= PRESSURE_STUCK_MIN_SWING_V)
        _stuck = false; // the sensor responds again
}

void PressureSensor::setScale(float pressure_scale) {
    _pressure_scale = pressure_scale;
    _pressure_step = pressure_scale / _pressure_adc_range;
}
