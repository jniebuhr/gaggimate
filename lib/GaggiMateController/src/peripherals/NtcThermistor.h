#ifndef NTCTHERMOCOUPLE_H
#define NTCTHERMOCOUPLE_H

#include "ADSAdc.h"
#include "TemperatureSensor.h"
#include "NtcTiming.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

constexpr float DEFAULT_RS = 10000.0f;  // voltage divider resistor value
constexpr float DEFAULT_VS = 5.0f;      // Vcc
constexpr float DEFAULT_BETA = 3950.0f; // Beta value
constexpr float To = 298.15f;           // Temperature in Kelvin for 25 degree Celsius
constexpr float DEFAULT_RO = 100000.0f; // Resistance of Thermistor at 25 degree Celsius

using temperature_error_callback_t = std::function<void()>;

class NtcThermistor : public TemperatureSensor {
  public:
    NtcThermistor(ADSAdc *adc, uint8_t channel, const temperature_error_callback_t &error_callback, float ro = DEFAULT_RO,
                  float Rs = DEFAULT_RS, float Vs = DEFAULT_VS, float Beta = DEFAULT_BETA, NtcTiming timing = {});
    float read() override;
    bool isErrorState() override;

    void setup() override;
    void loop();

  private:
    ADSAdc *_adc;
    uint8_t _channel;
    xTaskHandle taskHandle;

    NtcTiming _timing;
    NtcFaultWindow _faultWindow;
    bool _fault = false;
    bool _filterInitialized = false;

    float temperature = .0f;
    uint32_t _lastFreshMs = 0;
    uint32_t _lastFilterMs = 0;
    uint32_t _staleTimeoutMs = 1000;
    float _rs;
    float _vs;
    float _beta;
    float _ro;

    temperature_error_callback_t error_callback;

    const char *LOG_TAG = "NtcThermocouple";
    static void monitorTask(void *arg);
};

#endif // NTCTHERMOCOUPLE_H
