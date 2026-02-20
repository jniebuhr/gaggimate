#ifndef NTCTHERMOCOUPLE_H
#define NTCTHERMOCOUPLE_H

#include "ADSAdc.h"
#include "TemperatureSensor.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

constexpr int NTC_UPDATE_INTERVAL = 250;
constexpr int NTC_ERROR_WINDOW = 20;
constexpr float NTC_MAX_ERROR_RATE = 0.5f;
constexpr int NTC_MAX_ERRORS = static_cast<int>(static_cast<float>(NTC_ERROR_WINDOW) * NTC_MAX_ERROR_RATE);

constexpr float Rs = 10000.0f;  // voltage divider resistor value
constexpr float Vs = 5.0f;      // Vcc
constexpr float Beta = 3950.0f; // Beta value
constexpr float To = 298.15f;   // Temperature in Kelvin for 25 degree Celsius
constexpr float Ro = 100000.0f; // Resistance of Thermistor at 25 degree Celsius

using temperature_error_callback_t = std::function<void()>;

class NtcThermistor : public TemperatureSensor {
  public:
    NtcThermistor(ADSAdc *adc, uint8_t channel, const temperature_error_callback_t &error_callback);
    float read() override;
    bool isErrorState() override;

    void setup() override;
    void loop();

  private:
    ADSAdc *_adc;
    uint8_t _channel;
    xTaskHandle taskHandle;

    int errorCount = 0;
    std::array<int, NTC_ERROR_WINDOW> resultBuffer{};
    size_t resultCount = 0;
    size_t bufferIndex = 0;

    float temperature = .0f;

    temperature_error_callback_t error_callback;

    const char *LOG_TAG = "NtcThermocouple";
    static void monitorTask(void *arg);
};

#endif // NTCTHERMOCOUPLE_H
