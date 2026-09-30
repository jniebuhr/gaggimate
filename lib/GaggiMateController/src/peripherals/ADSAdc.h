#ifndef ADS_ADC_H
#define ADS_ADC_H

#include <ADS1X15.h>
#include <Arduino.h>
#include <array>
#include <esp_timer.h>
#include "AdcSchedule.h"

// Single-shot conversions at 860 SPS, serviced by a microsecond timer.
// Rates are configured per channel; zero disables a channel.
constexpr uint32_t ADC_I2C_CLOCK_HZ = 400000;
constexpr uint32_t ADC_CONVERSION_WAIT_US = 1400;
constexpr float ADC_STEP = 6.144f / 32767.0f;

using ads_callback_t = std::function<void(uint8_t, int)>;
using AdcRates = std::array<uint16_t, 4>;

class ADSAdc {
  public:
    ADSAdc(uint8_t sda_pin, uint8_t scl_pin, AdcRates rates = {500, 0, 0, 0});
    ~ADSAdc() = default;

    void setup();
    void loop();
    int getValue(uint8_t channel = 0) const { return _value[channel]; };
    void setScale(float pressure_scale);
    void registerCallback(ads_callback_t callback);
    uint16_t sampleRate(uint8_t channel) const { return channel < 4 ? _rates[channel] : 0; }
    bool consumeAverage(uint8_t channel, float &average, uint16_t &count, int &minimum, int &maximum);

  private:
    uint8_t _sda_pin;
    uint8_t _scl_pin;
    AdcRates _rates;
    uint8_t _currentChannel = 0;
    int _value[4] = {0, 0, 0, 0};
    ADS1115 *ads = nullptr;
    ads_callback_t _callback;
    xTaskHandle taskHandle;
    esp_timer_handle_t _timer = nullptr;
    AdcSchedule _schedule;
    int64_t _conversionStarted = 0;
    bool _pending = false;
    struct Window {
        int64_t sum = 0;
        uint16_t count = 0;
        int minimum = 32767;
        int maximum = -32768;
    };
    Window _windows[4];
    portMUX_TYPE _mux = portMUX_INITIALIZER_UNLOCKED;
    uint32_t _counts[4] = {};
    uint32_t _errors = 0;
    uint32_t _late = 0;
    int64_t _reportAt = 0;
    static void onTick(void *arg);

    const char *LOG_TAG = "ADSAdc";
    static void loopTask(void *arg);
};

#endif // ADS_ADC_H
