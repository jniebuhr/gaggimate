#ifndef HEATER_H
#define HEATER_H
#include <QuickPID.h>

#include "FreeRTOS.h"
#include "Max31855Thermocouple.h"
#include "TemperatureSensor.h"
#include <task.h>

constexpr int HEATER_UPDATE_INTERVAL = 250;
constexpr float TUNER_INPUT_SPAN = 0.0f;
constexpr float TUNER_OUTPUT_SPAN = 255.0f;
constexpr uint32_t TEST_TIME_SEC = 1;
constexpr uint16_t TUNER_SAMPLES = 1;

using heater_error_callback_t = std::function<void()>;

class Heater {
  public:
    Heater(TemperatureSensor *sensor, int heaterPin, const heater_error_callback_t &error_callback);
    void setup();
    void loop();
    void setSetpoint(float setpoint);
    void setTunings(float Kp, float Ki, float Kd);

  private:
    TemperatureSensor *sensor;
    int heaterPin;
    xTaskHandle taskHandle;
    QuickPID *pid;

    heater_error_callback_t error_callback;

    float temperature = 0;
    float output = 0;
    float setpoint = 0;
    float Kp = 2.4;
    float Ki = 40;
    float Kd = 10;

    const char *LOG_TAG = "Heater";
    static void loopTask(void *arg);
};

#endif // HEATER_H
