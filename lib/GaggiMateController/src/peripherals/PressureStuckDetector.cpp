#include "PressureStuckDetector.h"
#include <Arduino.h>
#include <algorithm>

void PressureStuckDetector::update(float pumpPower, bool fresh, float voltage) {
    if (pumpPower < PRESSURE_STUCK_PUMP_POWER) {
        // Judge a finished run: the voltage mean must have moved while the pump ran.
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
    _blockSum += voltage;
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
