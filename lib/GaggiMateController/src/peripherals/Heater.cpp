#include "Heater.h"
#include <Arduino.h>
#include <algorithm>
#include <cmath>

Heater::Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
               const pid_result_callback_t &pid_callback)
    : sensor(sensor), heaterPin(heaterPin), taskHandle(nullptr), error_callback(error_callback), pid_callback(pid_callback) {

    simplePid = new SimplePID(&output, &temperature, &setpoint);
    autotuner = new Autotune();
}

void Heater::setup() {
    pinMode(heaterPin, OUTPUT);
    setupPid();
    xTaskCreate(loopTask, "Heater::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void Heater::setupPid() {
    simplePid->setSamplingFrequency(TUNER_OUTPUT_SPAN / 1000.0f);
    simplePid->setCtrlOutputLimits(0.0f, TUNER_OUTPUT_SPAN);
    simplePid->activateSetPointFilter(false);
    simplePid->activateFeedForward(false);
    simplePid->reset();
}

void Heater::setupAutotune(int goal, int windowSize) {
    autotuner->setWindowsize(windowSize);
    autotuner->setEpsilon(0.1f);
    autotuner->setRequiredConfirmations(3);
    autotuner->setTuningGoal(goal);
    autotuner->reset();
}

void Heater::loop() {
    if (!sensor->isErrorState() && autotuning) {
        loopAutotune();
        return;
    }

    if (sensor->isErrorState() || setpoint <= 0.0f) {
        simplePid->setMode(SimplePID::Control::manual);
        digitalWrite(heaterPin, LOW);
        relayStatus = false;
        temperature = sensor->read();
        return;
    }
    simplePid->setMode(SimplePID::Control::automatic);

    loopPid();
}

void Heater::setSetpoint(float setpoint) {
    if (this->setpoint != setpoint) {
        this->setpoint = setpoint;
        ESP_LOGV(LOG_TAG, "Set setpoint %f°C", setpoint);
    }
}

void Heater::setTunings(float Kp, float Ki, float Kd) {
    if (simplePid->getKp() != Kp || simplePid->getKi() != Ki || simplePid->getKd() != Kd) {
        simplePid->setControllerPIDGains(Kp, Ki, Kd, 0.0f);
        simplePid->reset();
        ESP_LOGV(LOG_TAG, "Set tunings to Kp: %f, Ki: %f, Kd: %f", Kp, Ki, Kd);
    }
}


void Heater::setThermalFeedforward(float *pumpFlowPtr, float incomingWaterTemp, bool *valveStatusPtr) {
    pumpFlowRate = pumpFlowPtr;
    valveStatus = valveStatusPtr;
    this->incomingWaterTemp = incomingWaterTemp;
      
    ESP_LOGI(LOG_TAG, "Thermal feedforward setup - incoming water temp: %.1f°C, valve tracking: %s", 
             incomingWaterTemp, valveStatusPtr ? "enabled" : "disabled");
    ESP_LOGI(LOG_TAG, "Feedforward will be %s based on Kff value (currently %.3f)", 
             combinedKff > 0.0f ? "ENABLED" : "DISABLED", combinedKff);
}

void Heater::setFeedforwardScale(float combinedKff) {
    this->combinedKff = combinedKff;
    ESP_LOGI(LOG_TAG, "Combined feedforward gain (Kff) set to: %.3f output units per watt", combinedKff);
}

void Heater::autotune(int goal, int windowSize) {
    setupAutotune(goal, windowSize);
    autotuning = true;
}

void Heater::loopPid() {
    softPwm(TUNER_OUTPUT_SPAN);
    temperature = sensor->read();
    
    // Calculate and set disturbance feedforward BEFORE PID update
    // Only apply thermal feedforward when Kf>0, valve is open, and water is flowing
    if (combinedKff > 0.0f && pumpFlowRate && *pumpFlowRate > 0.01f && valveStatus && *valveStatus) {
        float currentFlowRate = *pumpFlowRate; // Use raw flow rate for fast response
        float disturbanceGain = calculateDisturbanceFeedforwardGain();
        
        // Apply smoothed temperature-based safety scaling
        float tempError = temperature - setpoint;
        float rawSafetyFactor = calculateSafetyScaling(tempError);
        
        // Smooth safety factor transitions to reduce oscillations
        const float safetyAlpha = 0.85f; // Faster response for quicker feedforward
        float safetyFactor = safetyAlpha * rawSafetyFactor + (1.0f - safetyAlpha) * lastSafetyFactor;
        lastSafetyFactor = safetyFactor;
        
        disturbanceGain *= safetyFactor;
        
        // Set the disturbance feedforward in SimplePID
        simplePid->setDisturbanceFeedforward(currentFlowRate, disturbanceGain);
        
    } else {
        simplePid->setDisturbanceFeedforward(0.0f, 0.0f);
    }
    
    // Now run PID with proper feedforward integrated
    bool pidUpdated = simplePid->update();
    
    if (pidUpdated) {
        plot(output, 1.0f, 1);
    }
}

void Heater::loopAutotune() {
    simplePid->setMode(SimplePID::Control::manual);
    autotuner->reset();
    long microseconds;
    long loopInterval = (static_cast<long>(TUNER_OUTPUT_SPAN) - 1L) * 1000L;
    while (!autotuner->isFinished()) {
        microseconds = micros();
        temperature = sensor->read();
        output = 0.0f;
        if (autotuner->maxPowerOn) {
            output = TUNER_OUTPUT_SPAN;
        }
        ESP_LOGI(LOG_TAG, "Autotuner Cycle: Temperature=%.2f", temperature);
        autotuner->update(temperature, millis() / 1000.0f);
        while (micros() - microseconds < loopInterval) {
            softPwm(TUNER_OUTPUT_SPAN);
            vTaskDelay(1 / portTICK_PERIOD_MS);
        }
        if (temperature > MAX_AUTOTUNE_TEMP) {
            output = 0.0f;
            autotuning = false;
            softPwm(TUNER_OUTPUT_SPAN);
            pid_callback(0, 0, 0);
            return;
        }
    }
    output = 0.0f;
    autotuning = false;
    softPwm(TUNER_OUTPUT_SPAN);

    pid_callback(autotuner->getKp() * 1000.0f, autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f);

    setTunings(autotuner->getKp() * 1000.0f, autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f);

    ESP_LOGI(LOG_TAG, "Autotuning finished: Kp=%.4f, Ki=%.4f, Kd=%.4f, Kff=%.4f\n", autotuner->getKp() * 1000.0f,
             autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f, autotuner->getKff() * 1000.0f);
    ESP_LOGI(LOG_TAG, "System delay: %.2f s, System gain: %.4f Setpoint Freq: %.4f Hz\n", autotuner->getSystemDelay(),
             autotuner->getSystemGain(), autotuner->getCrossoverFreq() / 2);
}

float Heater::softPwm(uint32_t windowSize) {
    // software PWM timer
    unsigned long msNow = millis();
    if (msNow - windowStartTime >= windowSize) {
        windowStartTime = msNow;
    }
    float optimumOutput = output;

    // PWM relay output
    if (!relayStatus && static_cast<unsigned long>(optimumOutput) > (msNow - windowStartTime)) {
        if (msNow > nextSwitchTime) {
            nextSwitchTime = msNow;
            relayStatus = true;
            digitalWrite(heaterPin, HIGH);
        }
    } else if (relayStatus && static_cast<unsigned long>(optimumOutput) < (msNow - windowStartTime)) {
        if (msNow > nextSwitchTime) {
            nextSwitchTime = msNow;
            relayStatus = false;
            digitalWrite(heaterPin, LOW);
        }
    }
    return optimumOutput;
}

void Heater::plot(float optimumOutput, float outputScale, uint8_t everyNth) {
    if (plotCount >= everyNth) {
        plotCount = 1;
        ESP_LOGV(LOG_TAG, "PID Plot: output=%.2f, input=%.2f, setpoint=%.2f", optimumOutput * outputScale, temperature, setpoint);
    } else
        plotCount++;
}

float Heater::calculateDisturbanceFeedforwardGain() {
    if (combinedKff <= 0.0f || !pumpFlowRate || *pumpFlowRate <= 0.01f) {
        return 0.0f;
    }
    
    float currentFlowRate = *pumpFlowRate; // Use raw flow rate for fast response
    
    // Calculate temperature difference (target - incoming water temperature)
    float tempDelta = setpoint - incomingWaterTemp;
    if (tempDelta <= 0.0f) return 0.0f;
    
    // Calculate thermal power needed per ml/s of flow (Watts per ml/s)
    float powerPerFlowRate = WATER_DENSITY * WATER_SPECIFIC_HEAT * tempDelta + (heatLossWatts / currentFlowRate);
    powerPerFlowRate /= heaterEfficiency;
    
    // Apply combined Kff directly (output units per watt)
    float gainPerFlowRate = powerPerFlowRate * combinedKff;
    
    return gainPerFlowRate;
}

float Heater::calculateSafetyScaling(float tempError) {
    // tempError = temperature - setpoint
    // Use smoother, less aggressive safety scaling to reduce oscillations
    if (tempError > 1.0f) {
        return 0.0f; // No FF if more than 1.0°C above setpoint
    } else if (tempError >= 0.0f) {
        // Gradual reduction: 100% at 0°C error, 70% at +1.0°C error
        return 0.7f + 0.3f * (1.0f - tempError / 1.0f);
    } else if (tempError > -1.0f) {
        // Scale from 70% to 100% as temperature drops below setpoint
        return 0.7f + 0.3f * std::abs(tempError) / 1.0f;
    } else {
        return 1.0f; // Full FF when more than 1.0°C below setpoint
    }
}

void Heater::loopTask(void *arg) {
    TickType_t lastWake = xTaskGetTickCount();
    auto *heater = static_cast<Heater *>(arg);
    while (true) {
        heater->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(10));
    }
}
