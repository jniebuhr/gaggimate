#ifndef HEATER_H
#define HEATER_H
#include "Autotune/Autotune.h"
#include "Max31855Thermocouple.h"
#include "TemperatureSensor.h"
#include <SimplePID/SimplePID.h>
#include <limits>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <atomic>

constexpr float MAX_AUTOTUNE_TEMP = 125.0f;
constexpr float TUNER_OUTPUT_SPAN = 1000.0f;

using heater_error_callback_t = std::function<void()>;
using heater_autotune_fail_callback_t = std::function<void()>;
// Kff = combinedKff = output units per watt (disturbance feedforward), derived
// in Heater::loopAutotune as 1000 / heaterWattage when wattage > 0; 0 when the
// caller didn't supply a wattage.
using pid_result_callback_t = std::function<void(float Kp, float Ki, float Kd, float Kff)>;

class Heater {
  public:
    Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
           const pid_result_callback_t &pid_callback, const heater_autotune_fail_callback_t &autotune_fail_callback = nullptr);
    void setup();
    void loop();

    void setSetpoint(float setpoint);
    float getSetpoint() { return setpoint; };
    float getDutyCycle() const { return output / TUNER_OUTPUT_SPAN * 100.0f; }
    void setTunings(float Kp, float Ki, float Kd);
    void autotune(int testTimeSec, int windowSize, int heaterWattage);
    void enableCoordination(bool allowAutotune);
    bool setCoordinatedState(bool on);
    bool isRequestingOn() const { return requestedState; }
    bool isAutotuning() const { return autotuning; }
    bool isCommandedOn() const { return relayStatus; }

    // Thermal feedforward control
    void setThermalFeedforward(float *pumpFlowPtr = nullptr, float incomingWaterTemp = 23.0f, int *valveStatusPtr = nullptr);
    void setFeedforwardScale(float combinedKff); // Set combined Kff value (output units per watt)

  private:
    void setupPid();
    void setupAutotune(int testTimeSec, int windowSize, int heaterWattage);
    void loopPid();
    void loopAutotune();
    float softPwm(uint32_t windowSize);
    void plot(float optimumOutput, float outputScale, uint8_t everyNth);
    float calculateDisturbanceFeedforwardGain();
    float calculateSafetyScaling(float tempError);
    TemperatureSensor *sensor;
    uint8_t heaterPin;
    xTaskHandle taskHandle;
    SimplePID *simplePid = nullptr;
    Autotune *autotuner = nullptr;

    heater_error_callback_t error_callback;
    pid_result_callback_t pid_callback;
    heater_autotune_fail_callback_t autotune_fail_callback;

    float outputTemperatureLimit = std::numeric_limits<float>::infinity();
    float temperature = 0.0f;
    float output = 0.0f;
    float setpoint = 0.0f;
    float Kp = 2.4;
    float Ki = 40;
    float Kd = 10;
    int plotCount = 0;

    std::atomic<bool> relayStatus{false};
    std::atomic<bool> requestedState{false};
    std::atomic<bool> heatEnabled{false};
    bool coordinated = false;
    bool allowCoordinatedAutotune = true;
    StaticSemaphore_t outputMutexStorage;
    SemaphoreHandle_t outputMutex = xSemaphoreCreateMutexStatic(&outputMutexStorage);
    void requestOutput(bool on);
    void writeOutput(bool on);
    unsigned long windowStartTime = 0;

    // Autotune variables
    bool startup = true;
    std::atomic<bool> autotuning{false};
    // Stashed at autotune-start (BLE field 3) so loopAutotune can derive
    // combinedKff = 1000 / wattage on completion. 0 ⇒ caller didn't supply
    // wattage (older display firmware) ⇒ skip combinedKff derivation.
    int autotuneHeaterWattage = 0;

    // Thermal feedforward variables
    float *pumpFlowRate = nullptr;
    int *valveStatus = nullptr;
    float lastSafetyFactor = 1.0f; // For smooth safety scaling transitions
    float incomingWaterTemp = 23.0f;
    float heaterEfficiency = 0.95f; // 95% efficiency (immersion heater)
    float heatLossWatts = 5.0f;     // 5W heat loss (well-insulated boiler)
    float combinedKff = 0.0f;       // Combined feedforward gain (output units per watt) - disabled by default

    // Thermal model constants
    static constexpr float WATER_DENSITY = 1.0f;        // g/ml
    static constexpr float WATER_SPECIFIC_HEAT = 4.18f; // J/(g·°C)

    const char *LOG_TAG = "Heater";
    static void loopTask(void *arg);
};

#endif // HEATER_H
