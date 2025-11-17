#ifndef HARDWARESCALE_H
#define HARDWARESCALE_H

#include <Arduino.h>
#include <functional>

constexpr int SCALE_READ_INTERVAL_MS = 100;
constexpr float HARDWARE_SCALE_UNAVAILABLE = -9999.0f;  // Sentinel value to signal scale not available

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
        inline float getWeight() const;
        inline RawReading getRawWeight() const { return _raw_weight; }
        void setScaleFactors(float scale_factor1, float scale_factor2);
        void calibrateScale(uint8_t scale, float calibrationWeight);
        bool isReady();
        bool isAvailable() const { return is_initialized; }
        void tare();

    private:
        bool is_initialized;
        bool _scale_factors_ready;
        uint8_t _data_pin1;
        uint8_t _data_pin2;
        uint8_t _clock_pin;
        RawReading _raw_weight;
        float _weight = 0.0f;
        float _scale_factor1;
        float _scale_factor2;
        float _offset1;
        float _offset2;
        bool _is_taring_or_calibrating;
        scale_reading_callback_t _reading_callback;
        scale_configuration_callback_t _configuration_callback;
        xTaskHandle taskHandle;

        const char *LOG_TAG = "HardwareScale";
        static void loopTask(void *arg);
        
        RawReading readRaw();
        float convertRawToWeight(const RawReading &raw) const;
};

#endif // HARDWARESCALE_H