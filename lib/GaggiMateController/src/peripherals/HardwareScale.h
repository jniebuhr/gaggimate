#ifndef HARDWARESCALE_H
#define HARDWARESCALE_H

#include <Arduino.h>
#include <atomic>
#include <functional>

constexpr int SCALE_READ_INTERVAL_MS = 100;
constexpr float HARDWARE_SCALE_UNAVAILABLE = -9999.0f;  // Sentinel value to signal scale not available

// Conditional outlier rejection handles isolated spikes, so both idle weighing
// and brewing can remain responsive without a slow stationary EMA.
constexpr float SCALE_FILTER_ALPHA_IDLE = 0.70f;
constexpr float SCALE_FILTER_ALPHA_ACTIVE = 0.70f;
constexpr uint8_t SCALE_TARE_SAMPLES = 5;

// Idle publishing uses spatial hysteresis rather than more temporal filtering,
// so a real weight change remains as responsive as the fast internal estimate.
constexpr float SCALE_DISPLAY_STEP_GRAMS = 0.10f;
constexpr float SCALE_DISPLAY_SWITCH_GRAMS = 0.07f;

// Track only small, stable, idle zero drift. Brew/water activity disables this
// path via setBrewingActive(), leaving shot measurements untouched.
constexpr float SCALE_ZERO_TRACK_WINDOW_GRAMS = 0.35f;
constexpr uint8_t SCALE_ZERO_TRACK_MEDIAN_SAMPLES = 3;
constexpr uint8_t SCALE_ZERO_TRACK_STABILITY_SAMPLES = 10;
constexpr float SCALE_ZERO_TRACK_MAX_RANGE_GRAMS = 0.15f;
constexpr float SCALE_ZERO_TRACK_ALPHA = 0.015f;
constexpr float SCALE_ZERO_TRACK_MAX_BIAS_GRAMS = 1.0f;

using scale_reading_callback_t = std::function<void(float)>;
using scale_configuration_callback_t = std::function<void(float scaleFactor1, float scaleFactor2)>;
using void_callback_t = std::function<void()>;

class HardwareScale {
    public:
        HardwareScale(uint8_t data_pin1, uint8_t data_pin2, uint8_t clock_pin,
            const scale_reading_callback_t &reading_callback,
            const scale_configuration_callback_t &config_callback);
        ~HardwareScale() = default;

         struct RawReading {
            long value1;
            long value2;
        };

        void setup();
        void loop();
        float getWeight() const;
        inline RawReading getRawWeight() const { return _raw_weight; }
        void setScaleFactors(float scale_factor1, float scale_factor2);
        void calibrateScale(uint8_t scale, float calibrationWeight);
        void setBrewingActive(bool active);
        bool isReady();
        bool isAvailable() const { return is_initialized; }
        bool tare();

    private:
        std::atomic<bool> is_initialized;
        std::atomic<bool> _scale_factors_ready;
        uint8_t _data_pin1;
        uint8_t _data_pin2;
        uint8_t _clock_pin;
        RawReading _raw_weight;
        std::atomic<float> _weight{0.0f};
        float _scale_factor1;
        float _scale_factor2;
        float _offset1;
        float _offset2;
        bool _has_accepted_reading = false;
        bool _has_pending_outlier = false;
        float _previous_accepted_reading = 0.0f;
        float _last_accepted_reading = 0.0f;
        float _pending_outlier = 0.0f;
        uint8_t _consecutive_read_failures = 0;
        bool _read_fault_reported = false;
        std::atomic<unsigned long> _responsive_until{0};
        float _published_weight = 0.0f;
        float _zero_bias = 0.0f;
        float _zero_median_samples[SCALE_ZERO_TRACK_MEDIAN_SAMPLES]{};
        uint8_t _zero_median_count = 0;
        uint8_t _zero_median_index = 0;
        float _zero_stability_samples[SCALE_ZERO_TRACK_STABILITY_SAMPLES]{};
        uint8_t _zero_stability_count = 0;
        uint8_t _zero_stability_index = 0;
        scale_reading_callback_t _reading_callback;
        scale_configuration_callback_t _configuration_callback;
        xTaskHandle taskHandle;
        SemaphoreHandle_t _operation_mutex;
        portMUX_TYPE _read_mux = portMUX_INITIALIZER_UNLOCKED;

        const char *LOG_TAG = "HardwareScale";
        static void loopTask(void *arg);

        RawReading readRaw();
        bool waitUntilReady(unsigned long timeoutMs) const;
        bool convertRawToWeight(const RawReading &raw, float &weight) const;
        bool acceptReading(float reading, float &accepted);
        bool isResponsive() const;
        void resetFilterState();
        void resetZeroTrackingHistory();
};

#endif // HARDWARESCALE_H
