#ifndef MAX31855THERMOCOUPLE_H
#define MAX31855THERMOCOUPLE_H

#include "TemperatureSensor.h"
#include <MAX31855.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

constexpr int MAX31855_UPDATE_INTERVAL = 250;
constexpr int MAX31855_MAX_ERRORS = 20;
constexpr double MAX_SAFE_TEMP = 170.0;

using temperature_callback_t = std::function<void(float)>;
using temperature_error_callback_t = std::function<void()>;

class Max31855Thermocouple : public TemperatureSensor {
  public:
    Max31855Thermocouple(int csPin, int misoPin, int sckPin, const temperature_callback_t &callback,
                         const temperature_error_callback_t &error_callback);
    float read() override;
    bool hasError() override;

    void setup();
    void loop();

  private:
    MAX31855 *max31855;
    xTaskHandle taskHandle;

    float errors = .0f;
    float temperature = .0f;

    int csPin = 0;
    int misoPin = 0;
    int sckPin = 0;

    temperature_callback_t callback;
    temperature_error_callback_t error_callback;

    const char *LOG_TAG = "Max31855Thermocouple";
    static void monitorTask(void *arg);
};

#endif // MAX31855THERMOCOUPLE_H
