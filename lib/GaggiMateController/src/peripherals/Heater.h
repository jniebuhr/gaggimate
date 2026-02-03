#ifndef HEATER_H
#define HEATER_H
#include "Autotune/Autotune.h"
#include "Max31855Thermocouple.h"
#include "TemperatureSensor.h"
#include <SimplePID/SimplePID.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

enum class PIDLibrary { Legacy, Nimrod };

constexpr float MAX_AUTOTUNE_TEMP = 125.0f;
constexpr float TUNER_OUTPUT_SPAN = 1000.0f;

using heater_error_callback_t = std::function<void()>;
using pid_result_callback_t = std::function<void(float Kp, float Ki, float Kd)>;

class Heater {
  public:
    Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
           const pid_result_callback_t &pid_callback);
    void setup();
    void loop();

    void setSetpoint(float setpoint);
    void setTunings(float Kp, float Ki, float Kd);
    void autotune(int goal, int windowSize);

    // Thermal feedforward control (uses pump flow + valve state).
    void setThermalFeedforward(float *pumpFlowPtr = nullptr, float incomingWaterTemp = 23.0f, int *valveStatusPtr = nullptr);
    void setFeedforwardScale(float combinedKff);  // Set combined Kff value (output units per watt)

  private:
    void setupPid();
    void setupAutotune(int goal, int windowSize);
    void loopPid();
    void loopAutotune();
    float softPwm(uint32_t windowSize);
    void plot(float optimumOutput, float outputScale, uint8_t everyNth);
    void setTuningGoal(float percent);
    float calculateDisturbanceFeedforwardGain();
    float calculateSafetyScaling(float tempError);
    TemperatureSensor *sensor;
    uint8_t heaterPin;
    xTaskHandle taskHandle;
    SimplePID *simplePid = nullptr;
    Autotune *autotuner = nullptr;

    heater_error_callback_t error_callback;
    pid_result_callback_t pid_callback;

    float temperature = 0.0f;
    float output = 0.0f;
    float setpoint = 0.0f;
    float Kp = 2.4;
    float Ki = 40;
    float Kd = 10;
    int plotCount = 0;

    bool relayStatus = false;
    unsigned long windowStartTime = 0;
    unsigned long nextSwitchTime = 0;

    // Autotune variables
    bool startup = true;
    bool autotuning = false;

    // Thermal feedforward variables
    float *pumpFlowRate = nullptr;
    int *valveStatus = nullptr;
    float lastSafetyFactor = 1.0f;  // For smooth safety scaling transitions
    float incomingWaterTemp = 23.0f;
    float heaterEfficiency = 0.95f;  // 95% efficiency (immersion heater)
    float heatLossWatts = 5.0f;      // 5W heat loss (well-insulated boiler)
    float combinedKff = 0.0f;        // Combined feedforward gain (output units per watt) - disabled by default

    // Thermal model constants
    static constexpr float WATER_DENSITY = 1.0f;        // g/ml
    static constexpr float WATER_SPECIFIC_HEAT = 4.18f; // J/(g·°C)

    const char *LOG_TAG = "Heater";
    static void loopTask(void *arg);
};

#endif // HEATER_H
