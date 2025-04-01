#ifndef HEATER_H
#define HEATER_H
#include <QuickPID.h>
#include <sTune.h>

#include "FreeRTOS.h"
#include "Max31855Thermocouple.h"
#include "TemperatureSensor.h"
#include <task.h>

constexpr float TUNER_INPUT_SPAN = 150.0f;
constexpr float TUNER_OUTPUT_SPAN = 1000.0f;
constexpr uint32_t TEST_TIME_SEC = 1;
constexpr uint16_t TUNER_SAMPLES = 1;
constexpr uint32_t TEST_TIME_SEC_AUTOTUNE = 300;
constexpr uint16_t TUNER_SAMPLES_AUTOTUNE = 1200;
constexpr uint16_t SETTLE_TIME_SEC_AUTOTUNE = 10;

using heater_error_callback_t = std::function<void()>;

class Heater {
  public:
    Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback);
    void setup();
    void setupPid();
    void setupAutotune();
    void loop();
    void setSetpoint(float setpoint);
    void setTunings(float Kp, float Ki, float Kd);

  private:
    void loopPid();
    void loopAutotune();

    TemperatureSensor *sensor;
    uint8_t heaterPin;
    xTaskHandle taskHandle;
    QuickPID *pid;
    sTune *tune;

    heater_error_callback_t error_callback;

    float temperature = 0;
    float output = 0;
    float setpoint = 0;
    float Kp = 2.4;
    float Ki = 40;
    float Kd = 10;


    // Autotune variables
    float outputStart = 0;
    float outputStep = 500;
    uint8_t debounce = 1;
    bool startup = true;

    const char *LOG_TAG = "Heater";
    static void loopTask(void *arg);
};

#endif // HEATER_H
