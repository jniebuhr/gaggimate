#include "HardwareScale.h"

#include <algorithm>
#include <cmath>

#define HX711_GAIN 128
#define MAX_SCALE_GRAMS 750.0f
#define MAX_WAIT_READ_MS 250
#define MAX_STARTUP_WAIT_MS 1200
#define SCALE_FACTOR_TIMEOUT_MS 10000
#define SCALE_FILTER_ALPHA 0.5f

HardwareScale::HardwareScale(uint8_t data_pin1, uint8_t data_pin2, uint8_t clock_pin,
                             const scale_reading_callback_t &reading_callback,
                             const scale_configuration_callback_t &config_callback)
    : _dataPin1(data_pin1), _dataPin2(data_pin2), _clockPin(clock_pin), _scaleFactor1(-2500.0f), _scaleFactor2(2500.0f),
      _offset1(0.0f), _offset2(0.0f), _isTaringOrCalibrating(false), _readingCallback(reading_callback),
      _configurationCallback(config_callback), taskHandle(nullptr) {
    _rawWeight = {0, 0};
}

void HardwareScale::setup() {
    pinMode(_dataPin1, INPUT);
    pinMode(_dataPin2, INPUT);
    pinMode(_clockPin, OUTPUT);
    digitalWrite(_clockPin, LOW);

    unsigned long start = millis();
    while (!isReady() && (millis() - start) < MAX_STARTUP_WAIT_MS) {
        delay(10);
    }
    if (!isReady()) {
        ESP_LOGW(LOG_TAG, "HX711 not ready at boot, hardware scale disabled");
        _initialized = false;
        return;
    }

    for (int i = 0; i < 5; i++) {
        unsigned long readStart = millis();
        while (!isReady() && (millis() - readStart) < MAX_WAIT_READ_MS) {
            delay(10);
        }
        if (!isReady()) {
            ESP_LOGW(LOG_TAG, "HX711 warmup failed, hardware scale disabled");
            _initialized = false;
            return;
        }
        readRaw();
    }

    tare();
    _initialized = true;
    ESP_LOGI(LOG_TAG, "Hardware scale initialized");

    _configurationCallback(_scaleFactor1, _scaleFactor2);
    xTaskCreate(loopTask, "HardwareScale::loop", configMINIMAL_STACK_SIZE * 3, this, 0, &taskHandle);
}

bool HardwareScale::isReady() { return digitalRead(_dataPin1) == LOW && digitalRead(_dataPin2) == LOW; }

HardwareScale::RawReading HardwareScale::readRaw() {
    unsigned long value1 = 0;
    unsigned long value2 = 0;

    portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
    portENTER_CRITICAL(&mux);

    for (int8_t i = 23; i >= 0; i--) {
        digitalWrite(_clockPin, HIGH);
        delayMicroseconds(1);
        value1 |= (digitalRead(_dataPin1) << i);
        value2 |= (digitalRead(_dataPin2) << i);
        digitalWrite(_clockPin, LOW);
        delayMicroseconds(1);
    }

    for (uint8_t i = 0; i < (HX711_GAIN == 128 ? 1 : (HX711_GAIN == 64 ? 3 : 2)); ++i) {
        digitalWrite(_clockPin, HIGH);
        delayMicroseconds(1);
        digitalWrite(_clockPin, LOW);
        delayMicroseconds(1);
    }

    portEXIT_CRITICAL(&mux);

    if (value1 & 0x800000) {
        value1 |= 0xFF000000;
    }
    if (value2 & 0x800000) {
        value2 |= 0xFF000000;
    }

    return {static_cast<long>(value1), static_cast<long>(value2)};
}

float HardwareScale::convertRawToWeight(const RawReading &raw) const {
    const float weight1 = (static_cast<float>(raw.value1) - _offset1) / _scaleFactor1;
    const float weight2 = (static_cast<float>(raw.value2) - _offset2) / _scaleFactor2;
    return std::clamp(std::round((weight1 + weight2) * 100.0f) / 100.0f, -1.0f * MAX_SCALE_GRAMS, MAX_SCALE_GRAMS);
}

float HardwareScale::getWeight() const { return _weight; }

void HardwareScale::loop() {
    if (!_initialized) {
        _readingCallback(HARDWARE_SCALE_UNAVAILABLE);
        return;
    }

    const unsigned long startWait = millis();
    while (!_scaleFactorsReady) {
        if (millis() - startWait > SCALE_FACTOR_TIMEOUT_MS) {
            ESP_LOGW(LOG_TAG, "Scale factor timeout, continuing with defaults");
            _scaleFactorsReady = true;
            break;
        }
        vTaskDelay(pdMS_TO_TICKS(250));
    }

    while (!isReady() || _isTaringOrCalibrating) {
        vTaskDelay(1);
    }

    _rawWeight = readRaw();
    const float reading = convertRawToWeight(_rawWeight);
    _weight = SCALE_FILTER_ALPHA * reading + (1.0f - SCALE_FILTER_ALPHA) * _weight;
    _weight = std::clamp(_weight, -1.0f * MAX_SCALE_GRAMS, MAX_SCALE_GRAMS);
    _readingCallback(_weight);
}

void HardwareScale::setScaleFactors(float scale_factor1, float scale_factor2) {
    if (!std::isfinite(scale_factor1) || !std::isfinite(scale_factor2) || std::abs(scale_factor1) < 0.001f ||
        std::abs(scale_factor2) < 0.001f) {
        ESP_LOGW(LOG_TAG, "Ignoring invalid scale factors: %.3f, %.3f", scale_factor1, scale_factor2);
        return;
    }
    _scaleFactor1 = scale_factor1;
    _scaleFactor2 = scale_factor2;
    _scaleFactorsReady = true;
    ESP_LOGI(LOG_TAG, "Scale factors applied: %.3f, %.3f", _scaleFactor1, _scaleFactor2);
}

void HardwareScale::tare() {
    _isTaringOrCalibrating = true;
    while (!isReady()) {
        delay(10);
    }
    const auto raw = readRaw();
    _offset1 = raw.value1;
    _offset2 = raw.value2;
    _weight = 0.0f;
    _isTaringOrCalibrating = false;
}

void HardwareScale::calibrateScale(uint8_t scale, float calibrationWeight) {
    _isTaringOrCalibrating = true;

    long value = 0;
    for (int i = 0; i < 10; i++) {
        while (!isReady()) {
            delay(10);
        }
        value += (scale == 0) ? readRaw().value1 : readRaw().value2;
    }
    value /= 10;

    if (scale == 0) {
        _scaleFactor1 = (static_cast<float>(value) - _offset1) / calibrationWeight;
    } else if (scale == 1) {
        _scaleFactor2 = (static_cast<float>(value) - _offset2) / calibrationWeight;
    }

    _isTaringOrCalibrating = false;
    _configurationCallback(_scaleFactor1, _scaleFactor2);
}

void HardwareScale::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *scale = static_cast<HardwareScale *>(arg);
    while (true) {
        scale->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(SCALE_READ_INTERVAL_MS));
    }
}
