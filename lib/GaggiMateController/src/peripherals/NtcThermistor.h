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

constexpr float DEFAULT_RS = 10000.0f;  // voltage divider resistor value
constexpr float DEFAULT_VS = 5.0f;      // Vcc
constexpr float DEFAULT_BETA = 3950.0f; // Beta value
constexpr float To = 298.15f;           // Temperature in Kelvin for 25 degree Celsius
constexpr float DEFAULT_RO = 100000.0f; // Resistance of Thermistor at 25 degree Celsius

using temperature_error_callback_t = std::function<void()>;

class NtcThermistor : public TemperatureSensor {
  public:
    NtcThermistor(ADSAdc *adc, uint8_t channel, const temperature_error_callback_t &error_callback, float ro = DEFAULT_RO,
                  float Rs = DEFAULT_RS, float Vs = DEFAULT_VS, float Beta = DEFAULT_BETA);
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
    float _rs;
    float _vs;
    float _beta;
    float _ro;

    temperature_error_callback_t error_callback;

    const char *LOG_TAG = "NtcThermocouple";
    static void monitorTask(void *arg);
};

#endif // NTCTHERMOCOUPLE_H
