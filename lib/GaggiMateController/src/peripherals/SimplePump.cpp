#include "SimplePump.h"

SimplePump::SimplePump(int pin, uint8_t pumpOn, float windowSize)
    : _pin(pin), _pumpOn(pumpOn), _windowSize(windowSize), taskHandle(nullptr) {}

void SimplePump::setup() {
    pinMode(_pin, OUTPUT);
    digitalWrite(_pin, !_pumpOn);
    xTaskCreate(loopTask, "SimplePump::loop", configMINIMAL_STACK_SIZE * 8, this, 1, &taskHandle);
}

void SimplePump::loop() {
    if (_setpoint == .0f) {
        digitalWrite(_pin, !_pumpOn);
        relayStatus = false;
        return;
    }

    if (_setpoint == 100.0f) {
        digitalWrite(_pin, _pumpOn);
        relayStatus = true;
        return;
    }

    float output = _setpoint / 100.0f * _windowSize;

    // software PWM timer
    unsigned long msNow = millis();
    if (msNow - windowStartTime >= static_cast<long>(_windowSize)) {
        windowStartTime = msNow;
    }

    // PWM relay output
    if (!relayStatus && static_cast<unsigned long>(output) > (msNow - windowStartTime)) {
        if (msNow > nextSwitchTime) {
            nextSwitchTime = msNow;
            relayStatus = true;
            digitalWrite(_pin, _pumpOn);
        }
    } else if (relayStatus && static_cast<unsigned long>(output) < (msNow - windowStartTime)) {
        if (msNow > nextSwitchTime) {
            nextSwitchTime = msNow;
            relayStatus = false;
            digitalWrite(_pin, !_pumpOn);
        }
    }
}

void SimplePump::setPower(float setpoint) {
    _setpoint = setpoint;
    if (_setpoint == .0f) {
        digitalWrite(_pin, !_pumpOn);
        relayStatus = false;
    }
    if (_setpoint == 100.0f) {
        digitalWrite(_pin, _pumpOn);
        relayStatus = true;
    }
}

void SimplePump::loopTask(void *arg) {
    auto *pump = static_cast<SimplePump *>(arg);
    while (true) {
        pump->loop();
        vTaskDelay(25 / portTICK_PERIOD_MS);
    }
}
