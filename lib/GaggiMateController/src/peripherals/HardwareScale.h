#ifndef HARDWARESCALE_H
#define HARDWARESCALE_H

#include <Arduino.h>
#include <functional>

constexpr int SCALE_READ_INTERVAL_MS = 100;
constexpr float HARDWARE_SCALE_UNAVAILABLE = -9999.0f;

using scale_reading_callback_t = std::function<void(float)>;
using scale_configuration_callback_t = std::function<void(float scaleFactor1, float scaleFactor2)>;

class HardwareScale {
  public:
    HardwareScale(uint8_t data_pin1, uint8_t data_pin2, uint8_t clock_pin, const scale_reading_callback_t &reading_callback,
                  const scale_configuration_callback_t &config_callback);
    ~HardwareScale() = default;

    struct RawReading {
        long value1;
        long value2;
    };

    void setup();
    void loop();
    float getWeight() const;
    RawReading getRawWeight() const { return _rawWeight; }
    void setScaleFactors(float scale_factor1, float scale_factor2);
    void calibrateScale(uint8_t scale, float calibrationWeight);
    bool isReady();
    bool isAvailable() const { return _initialized; }
    void tare();

  private:
    bool _initialized = false;
    bool _scaleFactorsReady = false;
    uint8_t _dataPin1;
    uint8_t _dataPin2;
    uint8_t _clockPin;
    RawReading _rawWeight;
    float _weight = 0.0f;
    float _scaleFactor1;
    float _scaleFactor2;
    float _offset1;
    float _offset2;
    bool _isTaringOrCalibrating;
    scale_reading_callback_t _readingCallback;
    scale_configuration_callback_t _configurationCallback;
    xTaskHandle taskHandle;

    const char *LOG_TAG = "HardwareScale";
    static void loopTask(void *arg);

    RawReading readRaw();
    float convertRawToWeight(const RawReading &raw) const;
};

#endif // HARDWARESCALE_H
