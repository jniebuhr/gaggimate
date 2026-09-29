#include "NtcThermistor.h"
#include <Arduino.h>
#include <SPI.h>
#include <cmath>
#include <algorithm>
#include <freertos/FreeRTOS.h>

NtcThermistor::NtcThermistor(ADSAdc *adc, uint8_t channel, const temperature_error_callback_t &error_callback, float ro, float Rs,
                             float Vs, float Beta, NtcTiming timing)
    : _adc(adc), _channel(channel), taskHandle(nullptr), _timing(timing),
      _rs(Rs), _vs(Vs), _beta(Beta), _ro(ro), error_callback(error_callback) {}

float NtcThermistor::read() { return isErrorState() ? 0.0f : temperature; }

bool NtcThermistor::isErrorState() {
    return temperature <= 0 || _fault || millis() - _lastFreshMs >= _staleTimeoutMs;
}

void NtcThermistor::setup() {
    if (_timing.updateIntervalMs < 20 || _timing.updateIntervalMs > 1000 ||
        !std::isfinite(_timing.smoothingTimeConstantMs) || _timing.smoothingTimeConstantMs < 0) {
        ESP_LOGE(LOG_TAG, "Invalid NTC timing configuration");
        _fault = true;
        error_callback();
        return;
    }
    _lastFreshMs = millis();
    const auto rate = _adc->sampleRate(_channel);
    _staleTimeoutMs = std::max(3u * _timing.updateIntervalMs, rate ? std::max(1000u, 3000u / rate) : 1000u);
    xTaskCreate(monitorTask, "NtcThermocouple::monitor", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void NtcThermistor::loop() {
    const uint32_t now = millis();
    float reading = 0.0f;
    uint16_t count = 0;
    int minimum = 0, maximum = 0;
    if (!_adc->consumeAverage(_channel, reading, count, minimum, maximum)) {
        if (now - _lastFreshMs >= _staleTimeoutMs) {
            _fault = true;
            error_callback();
        }
        return;
    }
    const uint32_t elapsedMs = now - _lastFreshMs;
    _lastFreshMs = now;
    if (_fault || temperature > MAX_SAFE_TEMP) {
        _fault = true;
        ESP_LOGE(LOG_TAG, "NTCThermistor failure! Temperature: %.2f", temperature);
        error_callback();
        return;
    }
    float Va = reading * ADC_STEP;
    float Rt = _rs * Va / (_vs - Va);
    float T = 1 / (1 / To + log(Rt / _ro) / _beta);
    float temp = T - 273.15;

    ESP_LOGV(LOG_TAG, "NTCThermistor: mean ADC: %.2f, samples: %u, temp: %.2f", reading, count, temp);
    const bool invalid = minimum <= 0 || maximum * ADC_STEP >= _vs || !std::isfinite(temp) || temp <= 0.0f;

    if (temp <= 0.0f) {
        ESP_LOGE(LOG_TAG, "Temperature reported below 0°C: %.2f\n", temp);
    }

    _fault = _faultWindow.update(invalid, elapsedMs);
    if (_fault) {
        error_callback();
        return;
    }

    if (invalid)
        return;
    // Initialize from a real reading, not an artificial ramp from zero.
    const float alpha = _timing.alpha(now - _lastFilterMs);
    temperature = _filterInitialized ? alpha * temp + (1.0f - alpha) * temperature : temp;
    _filterInitialized = true;
    _lastFilterMs = now;
    if (temperature > MAX_SAFE_TEMP) {
        _fault = true;
        error_callback();
        return;
    }
    ESP_LOGD(LOG_TAG, "Updated temperature: %2f", temperature);
}

[[noreturn]] void NtcThermistor::monitorTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *thermocouple = static_cast<NtcThermistor *>(arg);
    while (true) {
        thermocouple->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(thermocouple->_timing.updateIntervalMs));
    }
}
