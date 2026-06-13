#ifndef ADS_ADC_H
#define ADS_ADC_H

#include <ADS1X15.h>
#include <Arduino.h>

constexpr int ADC_READ_INTERVAL_MS = 30;
constexpr float ADC_STEP = 6.144f / 32767.0f;

using ads_callback_t = std::function<void(uint8_t, int)>;

class ADSAdc {
  public:
    ADSAdc(uint8_t sda_pin, uint8_t scl_pin, uint8_t numChannels = 1);
    ~ADSAdc() = default;

    void setup();
    void loop();
    int getValue(uint8_t channel = 0) const { return _value[channel]; };
    void setScale(float pressure_scale);
    void registerCallback(ads_callback_t callback);

  private:
    uint8_t _sda_pin;
    uint8_t _scl_pin;
    uint8_t _numChannels;
    uint8_t _currentChannel = 0;
    int _value[4] = {0, 0, 0, 0};
    ADS1115 *ads = nullptr;
    ads_callback_t _callback;
    xTaskHandle taskHandle;

    const char *LOG_TAG = "ADSAdc";
    static void loopTask(void *arg);
};

#endif // ADS_ADC_H
