// filepath: /Users/eric/Developer/gaggimate/lib/GaggiMateController/src/peripherals/HardwareScale.cpp

#include "HardwareScale.h"
#include <Arduino.h>
#include <algorithm>
#include <cmath>

#define HX711_GAIN 128
#define MAX_SCALE_GRAMS 750.0f
#define MAX_WAIT_READ_MS 250
#define MAX_STARTUP_WAIT_MS 1200

namespace {
constexpr float MIN_ABS_SCALE_FACTOR = 1.0f;
constexpr float TARE_MAX_SPREAD_GRAMS = 0.50f;
constexpr uint8_t TARE_MAX_ATTEMPTS = 2;
constexpr uint8_t READ_FAILURES_BEFORE_FAULT = 3;
constexpr unsigned long ACTIVE_FILTER_LINGER_MS = 5000;
constexpr float ACTIVE_OUTLIER_THRESHOLD_GRAMS = 0.75f;

bool validScaleFactor(float factor) { return std::isfinite(factor) && std::fabs(factor) >= MIN_ABS_SCALE_FACTOR; }

bool saturatedReading(long value) { return value == 0x7FFFFF || value == -0x800000; }
} // namespace

HardwareScale::HardwareScale(uint8_t data_pin1, uint8_t data_pin2, uint8_t clock_pin,
    const scale_reading_callback_t &reading_callback,
    const scale_configuration_callback_t &config_callback)
    : is_initialized(false), _scale_factors_ready(false),
    _data_pin1(data_pin1), _data_pin2(data_pin2), _clock_pin(clock_pin),
    _scale_factor1(-2500.0f), _scale_factor2(2500.0f),
    _offset1(0.0f), _offset2(0.0f),
    _reading_callback(reading_callback),
    _configuration_callback(config_callback),
    taskHandle(nullptr), _operation_mutex(nullptr) {
    _raw_weight = {0, 0};
}

void HardwareScale::setup() {
    _operation_mutex = xSemaphoreCreateMutex();
    if (_operation_mutex == nullptr) {
        ESP_LOGE(LOG_TAG, "Unable to create scale operation mutex");
        is_initialized = false;
        return;
    }

    pinMode(_data_pin1, INPUT);
    pinMode(_data_pin2, INPUT);
    pinMode(_clock_pin, OUTPUT);
    digitalWrite(_clock_pin, LOW);
    ESP_LOGV(LOG_TAG, "Initializing hardware scale on DATA1: %d, DATA2: %d, CLOCK: %d", _data_pin1, _data_pin2, _clock_pin);

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
    if (!tare()) {
        ESP_LOGE(LOG_TAG, "Unable to obtain a stable initial tare");
        is_initialized = false;
        return;
    }
    is_initialized = true;
    ESP_LOGI(LOG_TAG, "Hardware scale initialized successfully");

    // ensure we setup an initial value for the scale factors in the BLE server
    _configuration_callback(_scale_factor1, _scale_factor2);

    // Add small delay to ensure system stability before starting scale task
    delay(500);

    // Create task with lower priority (0 instead of 1) to not interfere with Bluetooth
    if (xTaskCreate(loopTask, "HardwareScale::loop", configMINIMAL_STACK_SIZE * 3, this, 0, &taskHandle) != pdPASS) {
        ESP_LOGE(LOG_TAG, "Unable to create hardware scale task");
        is_initialized = false;
        taskHandle = nullptr;
    }
}

bool HardwareScale::isReady() { return digitalRead(_data_pin1) == LOW && digitalRead(_data_pin2) == LOW; }

bool HardwareScale::waitUntilReady(unsigned long timeoutMs) const {
    const unsigned long started = millis();
    while (digitalRead(_data_pin1) != LOW || digitalRead(_data_pin2) != LOW) {
        if (millis() - started >= timeoutMs) {
            return false;
        }
        vTaskDelay(pdMS_TO_TICKS(1));
    }
    return true;
}

HardwareScale::RawReading HardwareScale::readRaw() {
    unsigned long value1 = 0;
    unsigned long value2 = 0;

    // Ensure that the read process is not interrupted. The timing of the SCK signal is critical for the HX711.
    // If an interrupt occurs during the read, and the pulse time exceeds 60 microseconds, the HX711 may enter power-down mode.
    // This can lead to corrupted readings.

    // The shared mux also prevents tare/calibration callbacks running on the
    // other core from clocking the HX711s at the same time as the scale task.
    portENTER_CRITICAL(&_read_mux);

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

    portEXIT_CRITICAL(&_read_mux);

    // Convert to signed 24-bit
    if (value1 & 0x800000) {
        value1 |= 0xFF000000;
    }

    if (value2 & 0x800000) {
        value2 |= 0xFF000000;
    }

    return {static_cast<long>(value1), static_cast<long>(value2)};
}

bool HardwareScale::convertRawToWeight(const RawReading &raw, float &weight) const {
    if (saturatedReading(raw.value1) || saturatedReading(raw.value2) || !validScaleFactor(_scale_factor1) ||
        !validScaleFactor(_scale_factor2)) {
        return false;
    }

    const float weight1 = (static_cast<float>(raw.value1) - _offset1) / _scale_factor1;
    const float weight2 = (static_cast<float>(raw.value2) - _offset2) / _scale_factor2;
    if (!std::isfinite(weight1) || !std::isfinite(weight2) || std::fabs(weight1) > MAX_SCALE_GRAMS ||
        std::fabs(weight2) > MAX_SCALE_GRAMS) {
        return false;
    }

    const float combined = weight1 + weight2;
    if (!std::isfinite(combined) || std::fabs(combined) > MAX_SCALE_GRAMS) {
        return false;
    }
    weight = combined;
    return true;
}

bool HardwareScale::isResponsive() const {
    return static_cast<int32_t>(_responsive_until.load() - millis()) > 0;
}

void HardwareScale::setBrewingActive(bool active) {
    if (active) {
        _responsive_until.store(millis() + ACTIVE_FILTER_LINGER_MS);
    }
}

void HardwareScale::resetFilterState() {
    _has_accepted_reading = false;
    _has_pending_outlier = false;
    _previous_accepted_reading = 0.0f;
    _last_accepted_reading = 0.0f;
    _pending_outlier = 0.0f;
    _published_weight = 0.0f;
    _zero_bias = 0.0f;
    resetZeroTrackingHistory();
}

void HardwareScale::resetZeroTrackingHistory() {
    _zero_median_count = 0;
    _zero_median_index = 0;
    _zero_stability_count = 0;
    _zero_stability_index = 0;
}

bool HardwareScale::acceptReading(float reading, float &accepted) {
    if (!_has_accepted_reading) {
        _has_accepted_reading = true;
        _previous_accepted_reading = reading;
        _last_accepted_reading = reading;
        accepted = reading;
        return true;
    }

    const bool responsive = isResponsive();
    if (!responsive) {
        // Outside a brew, responsiveness is more useful than holding a genuine
        // cup/weight change while waiting for two closely matching samples. The
        // EMA still damps noise; brew-time spike rejection remains enabled.
        _has_pending_outlier = false;
        _previous_accepted_reading = _last_accepted_reading;
        _last_accepted_reading = reading;
        accepted = reading;
        return true;
    }

    const float threshold = ACTIVE_OUTLIER_THRESHOLD_GRAMS;
    const float maxTrend = ACTIVE_OUTLIER_THRESHOLD_GRAMS;
    const float trend = std::clamp(_last_accepted_reading - _previous_accepted_reading, -maxTrend, maxTrend);
    const float predicted = _last_accepted_reading + trend;

    if (std::fabs(reading - predicted) <= threshold) {
        _has_pending_outlier = false;
    } else if (_has_pending_outlier && std::fabs(reading - _pending_outlier) <= threshold) {
        // A second reading near the first confirms a real step (for example a
        // cup being placed) rather than an isolated electrical/mechanical spike.
        _has_pending_outlier = false;
    } else {
        _pending_outlier = reading;
        _has_pending_outlier = true;
        return false;
    }

    _previous_accepted_reading = _last_accepted_reading;
    _last_accepted_reading = reading;
    accepted = reading;
    return true;
}

float HardwareScale::getWeight() const {
    return _weight.load();
}

void HardwareScale::loop() {
    // Send sentinel value if scale is not initialized
    if (!is_initialized) {
        _reading_callback(HARDWARE_SCALE_UNAVAILABLE); // Sentinel value to signal scale unavailable
        return;
    }

    // Wait for scale factors to be properly set before starting weight calculations
    // Use a reasonable timeout to prevent indefinite waiting
    unsigned long startWait = millis();
    const unsigned long SCALE_FACTOR_TIMEOUT_MS = 10000; // 10 seconds should be enough for BLE connection

    ESP_LOGV(LOG_TAG, "Waiting for scale factors from display controller...");

    while (!_scale_factors_ready) {
        if (millis() - startWait > SCALE_FACTOR_TIMEOUT_MS) {
            ESP_LOGW(LOG_TAG, "⚠️ Timeout waiting for scale factors after %lu ms, proceeding with defaults (readings will be inaccurate until calibrated)", SCALE_FACTOR_TIMEOUT_MS);
            _scale_factors_ready = true; // Allow operation with default factors
            break;
        }
        vTaskDelay(pdMS_TO_TICKS(250)); // Check every 250ms for scale factors
    }

    xSemaphoreTake(_operation_mutex, portMAX_DELAY);
    if (!waitUntilReady(MAX_WAIT_READ_MS)) {
        xSemaphoreGive(_operation_mutex);
        _consecutive_read_failures++;
        if (_consecutive_read_failures >= READ_FAILURES_BEFORE_FAULT && !_read_fault_reported) {
            ESP_LOGE(LOG_TAG, "HX711 runtime timeout (%d, %d); marking scale unavailable until readings recover",
                     digitalRead(_data_pin1), digitalRead(_data_pin2));
            _read_fault_reported = true;
            _reading_callback(HARDWARE_SCALE_UNAVAILABLE);
        }
        return;
    }

    _raw_weight = readRaw();
    ESP_LOGV(LOG_TAG, "Raw Scale Reading: %ld, %ld", _raw_weight.value1, _raw_weight.value2);
    float reading = 0.0f;
    float accepted = 0.0f;
    if (!convertRawToWeight(_raw_weight, reading)) {
        xSemaphoreGive(_operation_mutex);
        _consecutive_read_failures++;
        if (_consecutive_read_failures == 1 || _consecutive_read_failures == READ_FAILURES_BEFORE_FAULT) {
            ESP_LOGW(LOG_TAG, "Rejected invalid HX711 sample: %ld, %ld", _raw_weight.value1, _raw_weight.value2);
        }
        if (_consecutive_read_failures >= READ_FAILURES_BEFORE_FAULT && !_read_fault_reported) {
            _read_fault_reported = true;
            _reading_callback(HARDWARE_SCALE_UNAVAILABLE);
        }
        return;
    }

    if (!acceptReading(reading, accepted)) {
        xSemaphoreGive(_operation_mutex);
        ESP_LOGD(LOG_TAG, "Holding possible scale outlier: %.2fg", reading);
        return;
    }

    const bool responsive = isResponsive();
    float corrected = accepted - _zero_bias;

    // Qualify slow zero correction using a median-filtered rolling range. This
    // rejects both individual spikes and gradual movement that would pass a
    // consecutive-sample delta test. It runs only in the idle path and does not
    // add latency to the reported scale measurement.
    if (responsive) {
        resetZeroTrackingHistory();
    } else {
        _zero_median_samples[_zero_median_index] = accepted;
        _zero_median_index = (_zero_median_index + 1) % SCALE_ZERO_TRACK_MEDIAN_SAMPLES;
        if (_zero_median_count < SCALE_ZERO_TRACK_MEDIAN_SAMPLES) {
            _zero_median_count++;
        }

        if (_zero_median_count == SCALE_ZERO_TRACK_MEDIAN_SAMPLES) {
            float sortedMedianSamples[SCALE_ZERO_TRACK_MEDIAN_SAMPLES];
            std::copy(_zero_median_samples,
                      _zero_median_samples + SCALE_ZERO_TRACK_MEDIAN_SAMPLES,
                      sortedMedianSamples);
            std::sort(sortedMedianSamples, sortedMedianSamples + SCALE_ZERO_TRACK_MEDIAN_SAMPLES);
            const float medianAccepted = sortedMedianSamples[SCALE_ZERO_TRACK_MEDIAN_SAMPLES / 2];

            if (std::fabs(medianAccepted - _zero_bias) <= SCALE_ZERO_TRACK_WINDOW_GRAMS) {
                _zero_stability_samples[_zero_stability_index] = medianAccepted;
                _zero_stability_index =
                    (_zero_stability_index + 1) % SCALE_ZERO_TRACK_STABILITY_SAMPLES;
                if (_zero_stability_count < SCALE_ZERO_TRACK_STABILITY_SAMPLES) {
                    _zero_stability_count++;
                }

                if (_zero_stability_count == SCALE_ZERO_TRACK_STABILITY_SAMPLES) {
                    const auto [minimum, maximum] = std::minmax_element(
                        _zero_stability_samples,
                        _zero_stability_samples + SCALE_ZERO_TRACK_STABILITY_SAMPLES);
                    const bool allNearZero = std::all_of(
                        _zero_stability_samples,
                        _zero_stability_samples + SCALE_ZERO_TRACK_STABILITY_SAMPLES,
                        [this](float sample) {
                            return std::fabs(sample - _zero_bias) <= SCALE_ZERO_TRACK_WINDOW_GRAMS;
                        });

                    if (allNearZero && *maximum - *minimum <= SCALE_ZERO_TRACK_MAX_RANGE_GRAMS) {
                        float mean = 0.0f;
                        for (float sample : _zero_stability_samples) {
                            mean += sample;
                        }
                        mean /= SCALE_ZERO_TRACK_STABILITY_SAMPLES;
                        _zero_bias = std::clamp(
                            _zero_bias + SCALE_ZERO_TRACK_ALPHA * (mean - _zero_bias),
                            -SCALE_ZERO_TRACK_MAX_BIAS_GRAMS,
                            SCALE_ZERO_TRACK_MAX_BIAS_GRAMS);
                        corrected = accepted - _zero_bias;
                    }
                }
            } else {
                resetZeroTrackingHistory();
            }
        }
    }

    const float alpha = responsive ? SCALE_FILTER_ALPHA_ACTIVE : SCALE_FILTER_ALPHA_IDLE;
    const float filtered_weight = alpha * corrected + (1.0f - alpha) * _weight.load();
    _weight.store(filtered_weight);

    // The UI renders tenths of a gram. Publishing with hysteresis prevents a
    // stable value near a rounding boundary (for example 0.049/0.051g) from
    // alternating between adjacent digits. This does not affect the internal
    // fast filter, and is bypassed completely during scale-responsive activity.
    float output_weight = filtered_weight;
    if (!responsive) {
        if (std::fabs(filtered_weight - _published_weight) >= SCALE_DISPLAY_SWITCH_GRAMS) {
            _published_weight =
                std::round(filtered_weight / SCALE_DISPLAY_STEP_GRAMS) * SCALE_DISPLAY_STEP_GRAMS;
            if (std::fabs(_published_weight) < SCALE_DISPLAY_STEP_GRAMS * 0.5f) {
                _published_weight = 0.0f;
            }
        }
        output_weight = _published_weight;
    }
    xSemaphoreGive(_operation_mutex);

    if (_read_fault_reported) {
        ESP_LOGI(LOG_TAG, "HX711 readings recovered");
    }
    _consecutive_read_failures = 0;
    _read_fault_reported = false;
    ESP_LOGV(LOG_TAG, "Scale Reading: %0.2f, Corrected: %0.2f, Filtered: %0.2f, Published: %0.2f, alpha: %.2f",
             reading, corrected, filtered_weight, output_weight, alpha);
    _reading_callback(output_weight);
}

void HardwareScale::setScaleFactors(float scale_factor1, float scale_factor2) {
    if (!validScaleFactor(scale_factor1) || !validScaleFactor(scale_factor2)) {
        ESP_LOGE(LOG_TAG, "Rejected invalid scale factors: %.3f, %.3f", scale_factor1, scale_factor2);
        return;
    }
    xSemaphoreTake(_operation_mutex, portMAX_DELAY);
    _scale_factor1 = scale_factor1;
    _scale_factor2 = scale_factor2;
    // Zero correction is expressed in grams and is no longer valid after the
    // raw-counts-per-gram calibration changes.
    _zero_bias = 0.0f;
    resetZeroTrackingHistory();
    xSemaphoreGive(_operation_mutex);
    _scale_factors_ready = true;
    ESP_LOGI(LOG_TAG, "✓ Scale factors received and applied: %.3f, %.3f - scale readings now calibrated", _scale_factor1, _scale_factor2);
}

bool HardwareScale::tare() {
    xSemaphoreTake(_operation_mutex, portMAX_DELAY);

    RawReading samples[SCALE_TARE_SAMPLES]{};
    bool stable = false;
    for (uint8_t attempt = 0; attempt < TARE_MAX_ATTEMPTS && !stable; ++attempt) {
        bool complete = true;
        for (uint8_t i = 0; i < SCALE_TARE_SAMPLES; ++i) {
            if (!waitUntilReady(MAX_WAIT_READ_MS)) {
                complete = false;
                break;
            }
            samples[i] = readRaw();
        }
        if (!complete) {
            ESP_LOGW(LOG_TAG, "Tare attempt %u timed out waiting for HX711 data", attempt + 1);
            continue;
        }

        const auto [min1, max1] = std::minmax_element(
            samples, samples + SCALE_TARE_SAMPLES, [](const RawReading &a, const RawReading &b) { return a.value1 < b.value1; });
        const auto [min2, max2] = std::minmax_element(
            samples, samples + SCALE_TARE_SAMPLES, [](const RawReading &a, const RawReading &b) { return a.value2 < b.value2; });
        const float spread = std::fabs(static_cast<float>(max1->value1 - min1->value1) / _scale_factor1) +
                             std::fabs(static_cast<float>(max2->value2 - min2->value2) / _scale_factor2);
        stable = std::isfinite(spread) && spread <= TARE_MAX_SPREAD_GRAMS;
        if (!stable) {
            ESP_LOGW(LOG_TAG, "Tare attempt %u unstable (%.3fg spread)", attempt + 1, spread);
        }
    }

    if (!stable) {
        xSemaphoreGive(_operation_mutex);
        ESP_LOGE(LOG_TAG, "Tare rejected after %u unstable/timeout attempts; preserving previous offsets", TARE_MAX_ATTEMPTS);
        return false;
    }

    long values1[SCALE_TARE_SAMPLES];
    long values2[SCALE_TARE_SAMPLES];
    for (uint8_t i = 0; i < SCALE_TARE_SAMPLES; ++i) {
        values1[i] = samples[i].value1;
        values2[i] = samples[i].value2;
    }
    std::sort(values1, values1 + SCALE_TARE_SAMPLES);
    std::sort(values2, values2 + SCALE_TARE_SAMPLES);
    // Trim the high and low sample from each cell, then average the middle three.
    _offset1 = static_cast<float>(static_cast<int64_t>(values1[1]) + values1[2] + values1[3]) / 3.0f;
    _offset2 = static_cast<float>(static_cast<int64_t>(values2[1]) + values2[2] + values2[3]) / 3.0f;
    _weight.store(0.0f); // Reset weight to zero after tare
    resetFilterState();
    xSemaphoreGive(_operation_mutex);
    ESP_LOGI(LOG_TAG, "Tared scale offsets from %u stable samples: %.3f, %.3f", SCALE_TARE_SAMPLES, _offset1, _offset2);
    return true;
}

void HardwareScale::calibrateScale(uint8_t scale, float calibrationWeight) {
    if (scale > 1 || !std::isfinite(calibrationWeight) || calibrationWeight <= 0.0f || calibrationWeight > MAX_SCALE_GRAMS) {
        ESP_LOGE(LOG_TAG, "Rejected invalid calibration request: cell=%u weight=%.3f", scale, calibrationWeight);
        return;
    }
    xSemaphoreTake(_operation_mutex, portMAX_DELAY);

    int64_t value = 0;
    for (int i = 0; i < 10; i++) {
        if (!waitUntilReady(MAX_WAIT_READ_MS)) {
            xSemaphoreGive(_operation_mutex);
            ESP_LOGE(LOG_TAG, "Calibration timed out waiting for HX711 data");
            return;
        }
        value += (scale == 0) ? readRaw().value1 : readRaw().value2; // Read from the first scale
    }
    value /= 10;

    const float factor = (static_cast<float>(value) - (scale == 0 ? _offset1 : _offset2)) / calibrationWeight;
    if (!validScaleFactor(factor)) {
        xSemaphoreGive(_operation_mutex);
        ESP_LOGE(LOG_TAG, "Rejected invalid calculated scale factor: %.3f", factor);
        return;
    }
    if (scale == 0) {
        _scale_factor1 = factor;
    } else {
        _scale_factor2 = factor;
    }

    xSemaphoreGive(_operation_mutex);
    ESP_LOGI(LOG_TAG, "Calibrated scale %d with factor: %.3f", scale, (scale == 0 ? _scale_factor1 : _scale_factor2));
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
