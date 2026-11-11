#ifndef HEATER_H
#define HEATER_H
#include "Autotune/Autotune.h"
#include "HeatingCheck.h"
#include "Max31855Thermocouple.h"
#include "TemperatureSensor.h"
#include <SimplePID/SimplePID.h>
#include <atomic>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <memory>

constexpr float MAX_AUTOTUNE_TEMP = 125.0f;
constexpr float TUNER_OUTPUT_SPAN = 1000.0f;

using heater_error_callback_t = std::function<void()>;
using heater_autotune_fail_callback_t = std::function<void()>;
// Kff = combinedKff = output units per watt (disturbance feedforward), derived
// in Heater::loopAutotune as 1000 / heaterWattage when wattage > 0; 0 when the
// caller didn't supply a wattage.
using pid_result_callback_t = std::function<void(float Kp, float Ki, float Kd, float Kff)>;

class HeaterCoordinator;

class Heater {
  public:
    Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
           const pid_result_callback_t &pid_callback, const heater_autotune_fail_callback_t &autotune_fail_callback = nullptr);
    void setup();
    // Configure before setup(): high-duty observation time to gain at least 2 degrees.
    void setHeatingCheckTime(uint32_t ms) { heatingCheck.setHeatingTime(ms); }
    // Attach only to the brew heater: water flow invalidates a no-rise observation.
    void setHeatingCheckPump(float *power) { heatingCheckPumpPower = power; }
    void loop();

    void setSetpoint(float setpoint);
    float getSetpoint() { return setpoint; };
    float getDutyCycle() const { return output / TUNER_OUTPUT_SPAN * 100.0f; }
    void setTunings(float Kp, float Ki, float Kd);
    void autotune(int testTimeSec, int windowSize, int heaterWattage);
    bool isAutotuning() const { return autotuning; }
    // Safety off: clears the setpoint and aborts a running autotune.
    void stop();
    // Must be attached before setup() starts the heater task.
    void setCoordinator(HeaterCoordinator *coordinator) { this->coordinator = coordinator; }

    // Thermal feedforward control
    void setThermalFeedforward(float *pumpFlowPtr = nullptr, float incomingWaterTemp = 23.0f, int *valveStatusPtr = nullptr);
    void setFeedforwardScale(float combinedKff); // Set combined Kff value (output units per watt)

  private:
    bool checkHeating();
    void setupPid();
    void setupAutotune(int testTimeSec, int windowSize, int heaterWattage);
    void loopPid();
    void loopAutotune();
    float softPwm(uint32_t windowSize);
    void requestOutput(bool on);
    void writeOutput(bool on);
    void plot(float optimumOutput, float outputScale, uint8_t everyNth);
    float calculateDisturbanceFeedforwardGain();
    float calculateSafetyScaling(float tempError);
    TemperatureSensor *sensor;
    uint8_t heaterPin;
    xTaskHandle taskHandle;
    std::unique_ptr<SimplePID> simplePid;
    std::unique_ptr<Autotune> autotuner;

    heater_error_callback_t error_callback;
    pid_result_callback_t pid_callback;
    heater_autotune_fail_callback_t autotune_fail_callback;
    HeaterCoordinator *coordinator = nullptr;

    HeatingCheck heatingCheck;
    float *heatingCheckPumpPower = nullptr;
    std::atomic<bool> heatingFault{false};
    portMUX_TYPE outputMux = portMUX_INITIALIZER_UNLOCKED;
    uint32_t outputAccountedAt = 0;
    uint32_t totalOnMs = 0;
    bool outputOn = false;

    float temperature = 0.0f;
    float output = 0.0f;
    float setpoint = 0.0f;
    int plotCount = 0;

    unsigned long windowStartTime = 0;

    // Autotune variables
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

    friend class HeaterCoordinator;
};

#endif // HEATER_H
