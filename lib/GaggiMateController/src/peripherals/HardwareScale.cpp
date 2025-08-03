// filepath: /Users/eric/Developer/gaggimate/lib/GaggiMateController/src/peripherals/HardwareScale.cpp

#include "HardwareScale.h"
#include <Arduino.h>

#define HX711_GAIN 128
#define MAX_SCALE_GRAMS 1500.0f
#define MAX_WAIT_READ_MS 250
#define MAX_STARTUP_WAIT_MS 1200

HardwareScale::HardwareScale(uint8_t data_pin1, uint8_t data_pin2, uint8_t clock_pin, const scale_reading_callback_t &reading_callback, const scale_configuration_callback_t &config_callback)
    : _data_pin1(data_pin1), _data_pin2(data_pin2), _clock_pin(clock_pin), _scale_factor1(1.0f), _scale_factor2(1.0f),
      _offset1(0.0f), _offset2(0.0f), _is_taring_or_calibrating(false), _reading_callback(reading_callback), _configuration_callback(config_callback), taskHandle(nullptr) {
    _raw_weight = {0, 0};
}

void HardwareScale::setup() {
    pinMode(_data_pin1, INPUT);
    pinMode(_data_pin2, INPUT);
    pinMode(_clock_pin, OUTPUT);
    digitalWrite(_clock_pin, LOW);
    ESP_LOGV(LOG_TAG, "Initializing hardware scale on DATA: %d, CLOCK: %d", _data_pin, _clock_pin);
    
    long start = millis();
    while (!isReady() && (millis() - start) < MAX_STARTUP_WAIT_MS) {
            delay(10);
    }
    if (!isReady()) {
        ESP_LOGE(LOG_TAG, "HX711 modules (%d, %d) not ready after max wait time, aborting setup", digitalRead(_data_pin1), digitalRead(_data_pin2));
        is_initialized = false;
        return;
    } else {
        ESP_LOGI(LOG_TAG, "HX711 modules are ready after %d ms", millis() - start);
    }

    // do a warm-up of 5 readings
    for (int i = 0; i < 5; i++) {
        long start = millis();
        while (!isReady() && (millis() - start) < MAX_WAIT_READ_MS) {
            delay(10);
        }
        if (!isReady()) {
            ESP_LOGE(LOG_TAG, "HX711 modules (%d, %d) not ready after max wait time, aborting setup", digitalRead(_data_pin1), digitalRead(_data_pin2));
            is_initialized = false;
            return;
        }
        readRaw();
    }
    tare();
    is_initialized = true;
    ESP_LOGI(LOG_TAG, "Hardware scale initialized successfully");

    // ensure we setup an initial value for the scale factors in the BLE server
    _configuration_callback(_scale_factor1, _scale_factor2);

    xTaskCreate(loopTask, "HardwareScale::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

bool HardwareScale::isReady() { return digitalRead(_data_pin1) == LOW && digitalRead(_data_pin2) == LOW; }

HardwareScale::RawReading HardwareScale::readRaw() {
    unsigned long value1 = 0;
    unsigned long value2 = 0;

    // Ensure that the read process is not interrupted. The timing of the SCK signal is critical for the HX711.
    // If an interrupt occurs during the read, and the pulse time exceeds 60 microseconds, the HX711 may enter power-down mode.
    // This can lead to corrupted readings.
    noInterrupts();

    // Read 24 bits
    for (int8_t i = 23; i >= 0; i--) {
        digitalWrite(_clock_pin, HIGH);
        delayMicroseconds(1);
        value1 |= (digitalRead(_data_pin1) << i);
        value2 |= (digitalRead(_data_pin2) << i);
        digitalWrite(_clock_pin, LOW);
        delayMicroseconds(1);
    }

    // Set gain for next reading
    for (uint8_t i = 0; i < (HX711_GAIN == 128 ? 1 : (HX711_GAIN == 64 ? 3 : 2)); ++i) {
        digitalWrite(_clock_pin, HIGH);
        delayMicroseconds(1);
        digitalWrite(_clock_pin, LOW);
        delayMicroseconds(1);
    }

    interrupts();

    // Convert to signed 24-bit
    if (value1 & 0x800000) {
        value1 |= 0xFF000000;
    }

    if (value2 & 0x800000) {
        value2 |= 0xFF000000;
    }

    return {static_cast<long>(value1), static_cast<long>(value2)};
}

float HardwareScale::convertRawToWeight(const RawReading &raw) const {
    // throw away the bottom 7 bits, as we only have ~17 effective bits
    float weight1 = (static_cast<float>(raw.value1 & 0xFFFFFF80) - _offset1) / _scale_factor1;
    float weight2 = (static_cast<float>(raw.value2 & 0xFFFFFF80) - _offset2) / _scale_factor2;
    return std::clamp(std::round((weight1 + weight2) * 100.0f) / 100.0f, -1.0f * MAX_SCALE_GRAMS, MAX_SCALE_GRAMS);
}

float HardwareScale::getWeight() const {
    return _weight;
}

void HardwareScale::loop() {
    while (!isReady() || _is_taring_or_calibrating) {
        vTaskDelay(1);
    }

    _raw_weight = readRaw();
    ESP_LOGI(LOG_TAG, "Raw Scale Reading: %ld, %ld", _raw_weight.value1, _raw_weight.value2);
    float reading = convertRawToWeight(_raw_weight);
    _weight = 0.5f * reading + 0.5f * _weight;
    _weight = std::clamp(_weight, 0.0f, MAX_SCALE_GRAMS);
    ESP_LOGI(LOG_TAG, "Scale Reading: %0.2f, Smoothed Weight: %0.2f", reading, _weight);
    _reading_callback(_weight);
}

void HardwareScale::setScaleFactors(float scale_factor1, float scale_factor2) {
    _scale_factor1 = scale_factor1;
    _scale_factor2 = scale_factor2;
    ESP_LOGI(LOG_TAG, "Set scale factors: %.3f, %.3f", _scale_factor1, _scale_factor2);
}

void HardwareScale::tare() {
    _is_taring_or_calibrating = true;

    long raw1 = 0;
    long raw2 = 0;
    for (int i = 0; i < 10; i++) {
        while (!isReady()) {
            delay(10);
        }
        _raw_weight = readRaw();
        raw1 += _raw_weight.value1;
        raw2 += _raw_weight.value2;
    }
    _offset1 = raw1 / 10;
    _offset2 = raw2 / 10;
    _weight = 0.0f; // Reset weight to zero after tare
    ESP_LOGI(LOG_TAG, "Tared scale offsets: %.3f, %.3f", _offset1, _offset2);
    _is_taring_or_calibrating = false;
}

void HardwareScale::calibrateScale(uint8_t scale, float calibrationWeight) {
    _is_taring_or_calibrating = true;

    long value = 0;
    for (int i = 0; i < 10; i++) {
        while (!isReady()) {
            delay(10);
        }
        value += (scale == 0) ? readRaw().value1 : readRaw().value2; // Read from the first scale
    }
    value /= 10;

    if (scale == 0) {
        _scale_factor1 = (static_cast<float>(value) - _offset1) / calibrationWeight; // 2225.767
    } else if (scale == 1) {
        _scale_factor2 = (static_cast<float>(value) - _offset2) / calibrationWeight; // -2159.782
    }

    ESP_LOGI(LOG_TAG, "Calibrated scale %d with factor: %.3f", scale, (scale == 0 ? _scale_factor1 : _scale_factor2));
    _is_taring_or_calibrating = false;
    _configuration_callback(_scale_factor1, _scale_factor2);
}

[[noreturn]] void HardwareScale::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *scale = static_cast<HardwareScale *>(arg);
    while (true) {
        scale->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(SCALE_READ_INTERVAL_MS));
    }
}