// RpmSensor.cpp
#include "RpmSensor.h"

RpmSensor::RpmSensor(uint8_t pin, uint8_t pulsesPerRevolution)
    : _pin(pin), _pulsesPerRevolution(pulsesPerRevolution) {}

void RpmSensor::setup() {
    // Configure tach input and ISR on falling edge.
    pinMode(_pin, INPUT);
    attachInterruptArg(_pin, isrHandler, this, FALLING);
}

void IRAM_ATTR RpmSensor::isrHandler(void *arg) {
    auto *sensor = static_cast<RpmSensor *>(arg);
    uint32_t now = micros();
    if (sensor->_lastPulseMicros != 0) {
        sensor->_pulseInterval = now - sensor->_lastPulseMicros;
    }
    sensor->_lastPulseMicros = now;
}

void RpmSensor::update() {
    // Compute filtered RPM from the latest pulse interval.
    uint32_t interval;
    uint32_t lastPulse;
    uint32_t now = micros();
    noInterrupts();
    interval = _pulseInterval;
    lastPulse = _lastPulseMicros;
    interrupts();

    if (lastPulse == 0 || (now - lastPulse) > RPM_TIMEOUT_US || interval == 0) {
        _rpm = 0.0f;
        return;
    }

    float instantRpm = 60e6f / (static_cast<float>(interval) * _pulsesPerRevolution);

    constexpr float alpha = 0.2f;
    _rpm = alpha * instantRpm + (1.0f - alpha) * _rpm;
}
