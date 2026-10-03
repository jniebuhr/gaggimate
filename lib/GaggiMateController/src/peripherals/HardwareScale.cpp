// filepath: /Users/eric/Developer/gaggimate/lib/GaggiMateController/src/peripherals/HardwareScale.cpp

#include "HardwareScale.h"
#include <Arduino.h>
#include <algorithm>
#include <cmath>

#define HX711_GAIN 128
#define MAX_SCALE_GRAMS 2000.0f
#define MAX_STARTUP_WAIT_MS 1200

namespace {
constexpr float MIN_ABS_SCALE_FACTOR = 1.0f;
constexpr float TARE_MAX_SPREAD_GRAMS = 0.50f;
constexpr uint8_t TARE_MAX_ATTEMPTS = 2;
constexpr uint8_t MAX_TARE_SAMPLES = 20;
constexpr uint8_t MAX_CALIBRATION_SAMPLES = 40;
constexpr unsigned long READ_FAULT_DELAY_MS = 750;
// Slightly below 100 ms so a nominal 10-SPS converter whose millis() spacing
// occasionally rounds to 99 ms is not accidentally published at only 5 SPS.
constexpr unsigned long SCALE_PUBLICATION_INTERVAL_MS = 90;
constexpr unsigned long ZERO_TRACKING_OBSERVATION_INTERVAL_MS = 100;
constexpr unsigned long INTERVAL_DIAGNOSTIC_PERIOD_MS = 5000;
constexpr unsigned long ACTIVE_FILTER_LINGER_MS = 5000;
constexpr float ACTIVE_OUTLIER_THRESHOLD_GRAMS = 0.75f;

bool validScaleFactor(float factor) { return std::isfinite(factor) && std::fabs(factor) >= MIN_ABS_SCALE_FACTOR; }

bool saturatedReading(long value) { return value == 0x7FFFFF || value == -0x800000; }

bool validSampleRate(uint16_t sampleRateSps) { return sampleRateSps == 10 || sampleRateSps == 80; }

bool validAlpha(float alpha) { return std::isfinite(alpha) && alpha > 0.0f && alpha <= 1.0f; }
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
        while (!isReady() && (millis() - start) < readyTimeoutMs()) {
            delay(10);
        }
        if (!isReady()) {
            ESP_LOGE(LOG_TAG, "HX711 modules (%d, %d) not ready after max wait time, aborting setup", digitalRead(_data_pin1), digitalRead(_data_pin2));
            is_initialized = false;
            return;
        }
        readRaw();
    }
    // A noisy boot window must not make otherwise responsive HX711 hardware
    // unavailable. Unlike a user-requested tare, startup may use a trimmed-mean
    // fallback from a complete sample set when the stability check fails.
    if (!tareInternal(true)) {
        ESP_LOGE(LOG_TAG, "Unable to read enough samples for the initial tare");
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

bool HardwareScale::convertRawToWeight(const RawReading &raw, float &weight, float &cell1Weight,
                                       float &cell2Weight) const {
    if (saturatedReading(raw.value1) || saturatedReading(raw.value2) || !validScaleFactor(_scale_factor1) ||
        !validScaleFactor(_scale_factor2)) {
        return false;
    }

    cell1Weight = (static_cast<float>(raw.value1) - _offset1) / _scale_factor1;
    cell2Weight = (static_cast<float>(raw.value2) - _offset2) / _scale_factor2;
    if (!std::isfinite(cell1Weight) || !std::isfinite(cell2Weight) || std::fabs(cell1Weight) > MAX_SCALE_GRAMS ||
        std::fabs(cell2Weight) > MAX_SCALE_GRAMS) {
        return false;
    }

    const float combined = cell1Weight + cell2Weight;
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
    _last_zero_tracking_observation_ms = 0;
}

unsigned long HardwareScale::readyTimeoutMs() const {
    // Allow several expected conversion periods while still detecting a dead
    // converter promptly. DOUT readiness, not this estimate, gates every read.
    const unsigned long expectedMs = (1000UL + _config.sampleRateSps - 1) / _config.sampleRateSps;
    return std::max(100UL, expectedMs * 3UL);
}

uint8_t HardwareScale::tareSampleCount() const { return _config.sampleRateSps == 80 ? MAX_TARE_SAMPLES : 5; }

uint8_t HardwareScale::calibrationSampleCount() const {
    return _config.sampleRateSps == 80 ? MAX_CALIBRATION_SAMPLES : 10;
}

void HardwareScale::recordConversionInterval() {
    const unsigned long nowUs = micros();
    if (_last_conversion_us != 0) {
        const uint32_t intervalUs = nowUs - _last_conversion_us;
        _interval_total_us += intervalUs;
        _interval_count++;
        _interval_min_us = std::min(_interval_min_us, intervalUs);
        _interval_max_us = std::max(_interval_max_us, intervalUs);
    }
    _last_conversion_us = nowUs;

    const unsigned long nowMs = millis();
    if (_interval_log_started_ms == 0) {
        _interval_log_started_ms = nowMs;
    } else if (nowMs - _interval_log_started_ms >= INTERVAL_DIAGNOSTIC_PERIOD_MS && _interval_count > 0) {
        ESP_LOGV(LOG_TAG, "HX711 conversion intervals: configured=%u SPS, n=%lu, avg=%.2f ms, min=%.2f ms, max=%.2f ms",
                 _config.sampleRateSps, static_cast<unsigned long>(_interval_count),
                 static_cast<double>(_interval_total_us) / _interval_count / 1000.0,
                 static_cast<double>(_interval_min_us) / 1000.0, static_cast<double>(_interval_max_us) / 1000.0);
        _interval_log_started_ms = nowMs;
        _interval_count = 0;
        _interval_total_us = 0;
        _interval_min_us = UINT32_MAX;
        _interval_max_us = 0;
    }
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
        // This is intentionally consecutive-conversion logic: at 80 SPS a real
        // step is confirmed sooner, while a one-conversion glitch is still held.
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
        _reading_callback(HARDWARE_SCALE_UNAVAILABLE, 0.0f, 0.0f, false, false);
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
    if (!waitUntilReady(readyTimeoutMs())) {
        xSemaphoreGive(_operation_mutex);
        if (_read_failure_started_ms == 0) {
            _read_failure_started_ms = millis();
        }
        if (millis() - _read_failure_started_ms >= READ_FAULT_DELAY_MS && !_read_fault_reported) {
            ESP_LOGE(LOG_TAG, "HX711 runtime timeout (%d, %d); marking scale unavailable until readings recover",
                     digitalRead(_data_pin1), digitalRead(_data_pin2));
            _read_fault_reported = true;
            _reading_callback(HARDWARE_SCALE_UNAVAILABLE, 0.0f, 0.0f, false, false);
        }
        return;
    }

    _raw_weight = readRaw();
    recordConversionInterval();
    float reading = 0.0f;
    float accepted = 0.0f;
    float cell1Weight = 0.0f;
    float cell2Weight = 0.0f;
    if (!convertRawToWeight(_raw_weight, reading, cell1Weight, cell2Weight)) {
        xSemaphoreGive(_operation_mutex);
        if (_read_failure_started_ms == 0) {
            _read_failure_started_ms = millis();
            ESP_LOGW(LOG_TAG, "Rejected invalid HX711 sample: %ld, %ld", _raw_weight.value1, _raw_weight.value2);
        }
        if (millis() - _read_failure_started_ms >= READ_FAULT_DELAY_MS && !_read_fault_reported) {
            _read_fault_reported = true;
            _reading_callback(HARDWARE_SCALE_UNAVAILABLE, 0.0f, 0.0f, false, false);
        }
        return;
    }

    if (_read_fault_reported) {
        ESP_LOGI(LOG_TAG, "HX711 readings recovered");
    }
    _read_failure_started_ms = 0;
    _read_fault_reported = false;

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
    } else if (_last_zero_tracking_observation_ms == 0 ||
               millis() - _last_zero_tracking_observation_ms >= ZERO_TRACKING_OBSERVATION_INTERVAL_MS) {
        _last_zero_tracking_observation_ms = millis();
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

    const float alpha = responsive ? _config.activeAlpha : _config.idleAlpha;
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

    ESP_LOGV(LOG_TAG, "Scale Reading: %0.2f, Corrected: %0.2f, Filtered: %0.2f, Published: %0.2f, alpha: %.2f",
             reading, corrected, filtered_weight, output_weight, alpha);
    const unsigned long now = millis();
    if (_last_publish_ms == 0 || now - _last_publish_ms >= SCALE_PUBLICATION_INTERVAL_MS) {
        _last_publish_ms = now;
        _reading_callback(output_weight, cell1Weight, cell2Weight, true, true);
    }
}

void HardwareScale::setScaleFactors(float scale_factor1, float scale_factor2) {
    setConfiguration(scale_factor1, scale_factor2, _config.sampleRateSps, _config.idleAlpha, _config.activeAlpha);
}

void HardwareScale::setConfiguration(float scale_factor1, float scale_factor2, uint16_t sample_rate_sps,
                                     float idle_alpha, float active_alpha) {
    if (!validScaleFactor(scale_factor1)) {
        ESP_LOGW(LOG_TAG, "Invalid scale factor 1 %.3f; using -2500 counts/g", scale_factor1);
        scale_factor1 = -2500.0f;
    }
    if (!validScaleFactor(scale_factor2)) {
        ESP_LOGW(LOG_TAG, "Invalid scale factor 2 %.3f; using 2500 counts/g", scale_factor2);
        scale_factor2 = 2500.0f;
    }
    if (!validSampleRate(sample_rate_sps)) {
        ESP_LOGW(LOG_TAG, "Invalid/missing HX711 sample rate %u; using 10 SPS", sample_rate_sps);
        sample_rate_sps = HARDWARE_SCALE_DEFAULT_SAMPLE_RATE_SPS;
    }
    if (!validAlpha(idle_alpha)) {
        ESP_LOGW(LOG_TAG, "Invalid/missing idle filter alpha %.3f; using %.2f", idle_alpha,
                 HARDWARE_SCALE_DEFAULT_FILTER_ALPHA_IDLE);
        idle_alpha = HARDWARE_SCALE_DEFAULT_FILTER_ALPHA_IDLE;
    }
    if (!validAlpha(active_alpha)) {
        ESP_LOGW(LOG_TAG, "Invalid/missing brewing filter alpha %.3f; using %.2f", active_alpha,
                 HARDWARE_SCALE_DEFAULT_FILTER_ALPHA_ACTIVE);
        active_alpha = HARDWARE_SCALE_DEFAULT_FILTER_ALPHA_ACTIVE;
    }
    xSemaphoreTake(_operation_mutex, portMAX_DELAY);
    _scale_factor1 = scale_factor1;
    _scale_factor2 = scale_factor2;
    _config = {sample_rate_sps, idle_alpha, active_alpha};
    _last_conversion_us = 0;
    _interval_log_started_ms = 0;
    _interval_count = 0;
    _interval_total_us = 0;
    _interval_min_us = UINT32_MAX;
    _interval_max_us = 0;
    // Zero correction is expressed in grams and is no longer valid after the
    // raw-counts-per-gram calibration changes.
    _zero_bias = 0.0f;
    resetZeroTrackingHistory();
    xSemaphoreGive(_operation_mutex);
    _scale_factors_ready = true;
    ESP_LOGI(LOG_TAG, "Hardware scale configuration: sample rate=%u SPS, idle alpha=%.2f, active alpha=%.2f, scale factors=(%.3f, %.3f)",
             _config.sampleRateSps, _config.idleAlpha, _config.activeAlpha, _scale_factor1, _scale_factor2);
}

bool HardwareScale::tare() { return tareInternal(false); }

bool HardwareScale::tareInternal(bool allowUnstableFallback) {
    xSemaphoreTake(_operation_mutex, portMAX_DELAY);

    RawReading samples[MAX_TARE_SAMPLES]{};
    const uint8_t sampleCount = tareSampleCount();
    bool stable = false;
    bool haveCompleteSamples = false;
    float lastSpread = NAN;
    for (uint8_t attempt = 0; attempt < TARE_MAX_ATTEMPTS && !stable; ++attempt) {
        RawReading attemptSamples[MAX_TARE_SAMPLES]{};
        bool complete = true;
        for (uint8_t i = 0; i < sampleCount; ++i) {
            if (!waitUntilReady(readyTimeoutMs())) {
                complete = false;
                break;
            }
            attemptSamples[i] = readRaw();
        }
        if (!complete) {
            ESP_LOGW(LOG_TAG, "Tare attempt %u timed out waiting for HX711 data", attempt + 1);
            continue;
        }
        haveCompleteSamples = true;
        std::copy(attemptSamples, attemptSamples + sampleCount, samples);

        const auto [min1, max1] = std::minmax_element(
            samples, samples + sampleCount, [](const RawReading &a, const RawReading &b) { return a.value1 < b.value1; });
        const auto [min2, max2] = std::minmax_element(
            samples, samples + sampleCount, [](const RawReading &a, const RawReading &b) { return a.value2 < b.value2; });
        lastSpread = std::fabs(static_cast<float>(max1->value1 - min1->value1) / _scale_factor1) +
                     std::fabs(static_cast<float>(max2->value2 - min2->value2) / _scale_factor2);
        stable = std::isfinite(lastSpread) && lastSpread <= TARE_MAX_SPREAD_GRAMS;
        if (!stable) {
            ESP_LOGW(LOG_TAG, "Tare attempt %u unstable (%.3fg spread)", attempt + 1, lastSpread);
        }
    }

    if (!stable && (!allowUnstableFallback || !haveCompleteSamples)) {
        xSemaphoreGive(_operation_mutex);
        ESP_LOGE(LOG_TAG, "Tare rejected after %u unstable/timeout attempts; preserving previous offsets", TARE_MAX_ATTEMPTS);
        return false;
    }

    if (!stable) {
        ESP_LOGW(LOG_TAG,
                 "Initial tare exceeded the %.2fg stability limit (%.3fg spread); using robust offsets so scale acquisition can start",
                 TARE_MAX_SPREAD_GRAMS, lastSpread);
    }

    long values1[MAX_TARE_SAMPLES];
    long values2[MAX_TARE_SAMPLES];
    for (uint8_t i = 0; i < sampleCount; ++i) {
        values1[i] = samples[i].value1;
        values2[i] = samples[i].value2;
    }
    std::sort(values1, values1 + sampleCount);
    std::sort(values2, values2 + sampleCount);
    // Trim one high and low sample from each cell, then average the remainder.
    int64_t sum1 = 0;
    int64_t sum2 = 0;
    for (uint8_t i = 1; i + 1 < sampleCount; ++i) {
        sum1 += values1[i];
        sum2 += values2[i];
    }
    _offset1 = static_cast<float>(sum1) / (sampleCount - 2);
    _offset2 = static_cast<float>(sum2) / (sampleCount - 2);
    _weight.store(0.0f); // Reset weight to zero after tare
    resetFilterState();
    _last_conversion_us = 0;
    xSemaphoreGive(_operation_mutex);
    ESP_LOGI(LOG_TAG, "Tared scale offsets from %u %s samples: %.3f, %.3f", sampleCount,
             stable ? "stable" : "startup fallback", _offset1, _offset2);
    return true;
}

void HardwareScale::calibrateScale(uint8_t scale, float calibrationWeight) {
    if (scale > 1 || !std::isfinite(calibrationWeight) || calibrationWeight <= 0.0f || calibrationWeight > MAX_SCALE_GRAMS) {
        ESP_LOGE(LOG_TAG, "Rejected invalid calibration request: cell=%u weight=%.3f", scale, calibrationWeight);
        return;
    }
    xSemaphoreTake(_operation_mutex, portMAX_DELAY);

    int64_t value = 0;
    const uint8_t sampleCount = calibrationSampleCount();
    for (uint8_t i = 0; i < sampleCount; i++) {
        if (!waitUntilReady(readyTimeoutMs())) {
            _last_conversion_us = 0;
            xSemaphoreGive(_operation_mutex);
            ESP_LOGE(LOG_TAG, "Calibration timed out waiting for HX711 data");
            return;
        }
        value += (scale == 0) ? readRaw().value1 : readRaw().value2; // Read from the first scale
    }
    value /= sampleCount;

    const float factor = (static_cast<float>(value) - (scale == 0 ? _offset1 : _offset2)) / calibrationWeight;
    if (!validScaleFactor(factor)) {
        _last_conversion_us = 0;
        xSemaphoreGive(_operation_mutex);
        ESP_LOGE(LOG_TAG, "Rejected invalid calculated scale factor: %.3f", factor);
        return;
    }
    if (scale == 0) {
        _scale_factor1 = factor;
    } else {
        _scale_factor2 = factor;
    }

    _last_conversion_us = 0;
    xSemaphoreGive(_operation_mutex);
    ESP_LOGI(LOG_TAG, "Calibrated scale %d with factor: %.3f", scale, (scale == 0 ? _scale_factor1 : _scale_factor2));
    _configuration_callback(_scale_factor1, _scale_factor2);
}

[[noreturn]] void HardwareScale::loopTask(void *arg) {
    auto *scale = static_cast<HardwareScale *>(arg);
    while (true) {
        // loop() waits cooperatively for both DOUT pins to indicate a completed
        // conversion. This consumes every 10- or 80-SPS conversion without a
        // fixed polling cadence or a CPU-burning busy loop.
        scale->loop();
        taskYIELD();
    }
}
