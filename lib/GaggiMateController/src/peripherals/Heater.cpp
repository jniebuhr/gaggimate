#include "Heater.h"
#include <Arduino.h>
#include <algorithm>
#include <cmath>

Heater::Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
               const pid_result_callback_t &pid_callback, const heater_autotune_fail_callback_t &autotune_fail_callback)
    : sensor(sensor), heaterPin(heaterPin), taskHandle(nullptr), error_callback(error_callback), pid_callback(pid_callback),
      autotune_fail_callback(autotune_fail_callback) {

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

void Heater::setupAutotune(int testTimeSec, int windowSize, int heaterWattage) {
    // SIMC rebuild: first BLE arg = test-duration seconds (see Autotune.h),
    // not legacy phase-margin aggressiveness. Slope threshold + confirmation
    // count owned by Autotune.h defaults (0.1 °C/s, 5 confirms) — quantisation
    // resilience. Wattage stashed for loopAutotune → combinedKff = 1000 / W.
    autotuner->setWindowsize(windowSize > 0 ? windowSize : 6);
    autotuner->setTimeOut(static_cast<float>(testTimeSec > 0 ? testTimeSec : 120));
    autotuneHeaterWattage = heaterWattage > 0 ? heaterWattage : 0;
    autotuner->reset();
}

void Heater::loop() {
    const bool sensorError = sensor->isErrorState();
    if (!sensorError && autotuning) {
        loopAutotune();
        return;
    }

    if (sensorError || setpoint <= 0.0f) {
        simplePid->setMode(SimplePID::Control::manual);
        output = 0.0f;
        digitalWrite(heaterPin, LOW);
        relayStatus = false;
        measuredTemperature = sensor->read();
        temperature = measuredTemperature;
        if (predictorControlActive) {
            resetTemperaturePredictor(sensorError ? NAN : measuredTemperature, 0.0f,
                                      sensorError ? TemperaturePredictor::FallbackReason::InvalidInput
                                                  : TemperaturePredictor::FallbackReason::Disabled);
        } else if (sensorError) {
            portENTER_CRITICAL(&predictorMux);
            predictorResult.active = false;
            predictorResult.residual = 0.0f;
            predictorResult.modelLead = 0.0f;
            predictorResult.fallbackReason = TemperaturePredictor::FallbackReason::InvalidInput;
            portEXIT_CRITICAL(&predictorMux);
        }
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

void Heater::setThermalFeedforward(float *pumpFlowPtr, float incomingWaterTemp, int *valveStatusPtr) {
    pumpFlowRate = pumpFlowPtr;
    valveStatus = valveStatusPtr;
    this->incomingWaterTemp = incomingWaterTemp;

    ESP_LOGI(LOG_TAG, "Thermal feedforward setup - incoming water temp: %.1f°C, valve tracking: %s", incomingWaterTemp,
             valveStatusPtr ? "enabled" : "disabled");
    ESP_LOGI(LOG_TAG, "Feedforward will be %s based on Kff value (currently %.3f)", combinedKff > 0.0f ? "ENABLED" : "DISABLED",
             combinedKff);
}

void Heater::setFeedforwardScale(float combinedKff) {
    this->combinedKff = combinedKff;
    ESP_LOGI(LOG_TAG, "Combined feedforward gain (Kff) set to: %.3f output units per watt", combinedKff);
}

bool Heater::configureTemperaturePredictor(bool enabled, float delaySeconds, float processGain, float lagSeconds) {
    portENTER_CRITICAL(&predictorMux);
    const TemperaturePredictor::Config current = temperaturePredictor.getConfig();
    if (current.enabled == enabled && current.delaySeconds == delaySeconds && current.processGain == processGain &&
        current.lagSeconds == lagSeconds) {
        const bool valid = !enabled || temperaturePredictor.isConfigured();
        portEXIT_CRITICAL(&predictorMux);
        return valid;
    }

    TemperaturePredictor::Config config;
    config.enabled = enabled;
    config.delaySeconds = delaySeconds;
    config.processGain = processGain;
    config.lagSeconds = lagSeconds;
    const bool valid = temperaturePredictor.configure(config);
    predictorResult = temperaturePredictor.getLastResult();
    predictorResult.active = false;
    predictorResult.fallbackReason = TemperaturePredictor::FallbackReason::Disabled;
    lastPredictorUpdate = 0;
    lastDisturbanceDuty = 0.0f;
    portEXIT_CRITICAL(&predictorMux);
    ESP_LOGI(LOG_TAG, "Temperature predictor %s (L=%.2fs k'=%.4fC/s tau2=%.2fs)", valid ? "configured" : "disabled",
             delaySeconds, processGain, lagSeconds);
    return valid;
}

float Heater::getPredictorResidual() {
    portENTER_CRITICAL(&predictorMux);
    const float residual = predictorResult.residual;
    portEXIT_CRITICAL(&predictorMux);
    return residual;
}

bool Heater::isPredictorActive() {
    portENTER_CRITICAL(&predictorMux);
    const bool active = predictorResult.active;
    portEXIT_CRITICAL(&predictorMux);
    return active;
}

uint8_t Heater::getPredictorFallbackReason() {
    portENTER_CRITICAL(&predictorMux);
    const uint8_t reason = static_cast<uint8_t>(predictorResult.fallbackReason);
    portEXIT_CRITICAL(&predictorMux);
    return reason;
}

void Heater::resetTemperaturePredictor(float currentTemperature, float currentDuty,
                                       TemperaturePredictor::FallbackReason reason) {
    portENTER_CRITICAL(&predictorMux);
    temperaturePredictor.reset(currentTemperature, currentDuty);
    predictorResult = temperaturePredictor.getLastResult();
    predictorResult.active = false;
    predictorResult.fallbackReason = reason;
    lastPredictorUpdate = 0;
    lastDisturbanceDuty = 0.0f;
    portEXIT_CRITICAL(&predictorMux);
    predictorControlActive = false;
}

void Heater::autotune(int testTimeSec, int windowSize, int heaterWattage) {
    setupAutotune(testTimeSec, windowSize, heaterWattage);
    portENTER_CRITICAL(&predictorMux);
    predictorResult.active = false;
    predictorResult.fallbackReason = TemperaturePredictor::FallbackReason::Disabled;
    lastPredictorUpdate = 0;
    lastDisturbanceDuty = 0.0f;
    portEXIT_CRITICAL(&predictorMux);
    predictorControlActive = false;
    autotuning = true;
}

void Heater::loopPid() {
    softPwm(TUNER_OUTPUT_SPAN);
    measuredTemperature = sensor->read();
    bool predictorInitializedThisTick = false;
    if (!predictorControlActive) {
        const float initialDuty =
            std::abs(setpoint - measuredTemperature) <= 2.0f ? lastAutomaticDuty : 0.0f;
        resetTemperaturePredictor(measuredTemperature, initialDuty);
        predictorControlActive = true;
        predictorInitializedThisTick = true;
    }

    float currentFlowRate = 0.0f;
    float rawDisturbanceGain = 0.0f;
    float flowDisturbanceDuty = 0.0f;
    if (combinedKff > 0.0f && pumpFlowRate && *pumpFlowRate > 0.01f && valveStatus && *valveStatus != 0) {
        currentFlowRate = *pumpFlowRate;
        rawDisturbanceGain = calculateDisturbanceFeedforwardGain();
        const float tempDelta = std::max(0.0f, setpoint - incomingWaterTemp);
        const float flowHeatWatts =
            WATER_DENSITY * WATER_SPECIFIC_HEAT * tempDelta * currentFlowRate / heaterEfficiency;
        // The predictor operating point already represents steady heat loss;
        // only the flow-dependent cooling load belongs in its disturbance.
        flowDisturbanceDuty = flowHeatWatts * combinedKff / TUNER_OUTPUT_SPAN;
    }

    const unsigned long now = millis();
    const bool controlTickDue = simplePid->isUpdateDue();
    portENTER_CRITICAL(&predictorMux);
    if (predictorInitializedThisTick) {
        // The first automatic tick deliberately uses raw feedback. Start the
        // model clock now so the next tick integrates the duty actually
        // applied during this interval.
        lastPredictorUpdate = now;
        lastDisturbanceDuty = flowDisturbanceDuty;
    } else if (controlTickDue) {
        const float dtSeconds =
            lastPredictorUpdate == 0 ? 1.0f : static_cast<float>(now - lastPredictorUpdate) / 1000.0f;
        // output and lastDisturbanceDuty describe the interval that just
        // elapsed; the newly sampled flow drives feedforward for the next one.
        predictorResult =
            temperaturePredictor.update(measuredTemperature, output / TUNER_OUTPUT_SPAN, lastDisturbanceDuty, dtSeconds);
        lastPredictorUpdate = now;
        lastDisturbanceDuty = flowDisturbanceDuty;
    }
    const TemperaturePredictor::Result currentPrediction = predictorResult;
    portEXIT_CRITICAL(&predictorMux);
    temperature = currentPrediction.active ? currentPrediction.temperature : measuredTemperature;

    // Raw sensing remains authoritative for declaring thermal runaway.
    if (measuredTemperature > static_cast<float>(MAX_SAFE_TEMP)) {
        output = 0.0f;
        digitalWrite(heaterPin, LOW);
        relayStatus = false;
        ESP_LOGE(LOG_TAG, "Raw overtemperature %.1f°C; shutting down", measuredTemperature);
        if (error_callback) {
            error_callback();
        }
        return;
    }
    // A high prediction cuts heater power immediately but does not latch a
    // runaway fault until the independent raw sensor confirms it.
    if (currentPrediction.active && temperature > static_cast<float>(MAX_SAFE_TEMP)) {
        output = 0.0f;
        digitalWrite(heaterPin, LOW);
        relayStatus = false;
        if (controlTickDue) {
            simplePid->skipUpdate();
        }
        ESP_LOGW(LOG_TAG, "Predicted overtemperature %.1f°C; heater inhibited pending raw confirmation", temperature);
        return;
    }

    // Calculate and set disturbance feedforward BEFORE PID update
    // Only apply thermal feedforward when Kf>0, valve is open, and water is flowing
    if (rawDisturbanceGain > 0.0f) {
        float disturbanceGain = rawDisturbanceGain;

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
        lastAutomaticDuty = output / TUNER_OUTPUT_SPAN;
        plot(output, 1.0f, 1);
    }
}

void Heater::loopAutotune() {
    simplePid->setMode(SimplePID::Control::manual);
    measuredTemperature = sensor->read();
    temperature = measuredTemperature;
    resetTemperaturePredictor(measuredTemperature);
    autotuner->reset();
    long microseconds;
    long loopInterval = (static_cast<long>(TUNER_OUTPUT_SPAN) - 1L) * 1000L;
    while (!autotuner->isFinished()) {
        microseconds = micros();
        // Re-check sensor every iteration. Heater::loop entry gate sampled
        // once — mid-test fault would leave relay stuck at full power for
        // rest of window. Max31855Thermocouple::read() returns 0 on fault;
        // neither overtemp guard nor autotuner state machine detects it.
        if (sensor->isErrorState()) {
            output = 0.0f;
            autotuning = false;
            softPwm(TUNER_OUTPUT_SPAN);
            resetTemperaturePredictor(NAN, 0.0f, TemperaturePredictor::FallbackReason::InvalidInput);
            ESP_LOGE(LOG_TAG, "Autotune aborted: sensor fault mid-test");
            if (error_callback) {
                error_callback();
            }
            return;
        }
        measuredTemperature = sensor->read();
        temperature = measuredTemperature;
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
            resetTemperaturePredictor(temperature);
            // Overtemp abort. Preserve NVS gains — skip pid_callback. Surface
            // as runaway so display drops machine into standby.
            ESP_LOGE(LOG_TAG, "Autotune aborted: temperature %.1f°C exceeds %.1f°C", temperature, MAX_AUTOTUNE_TEMP);
            if (error_callback) {
                error_callback();
            }
            return;
        }
    }
    output = 0.0f;
    autotuning = false;
    softPwm(TUNER_OUTPUT_SPAN);
    resetTemperaturePredictor(temperature);

    if (autotuner->isTimedOut()) {
        // Reaction/inflection never detected in window. Keep NVS PID — never
        // call pid_callback with zeros (#672 crash). Use dedicated
        // autotune-fail callback (→ ERROR_CODE_AUTOTUNE_TIMEOUT) so display
        // doesn't mistake it for runaway + force pump/valve off.
        // getTimeOut() = configured window. getSystemDelay() only set on
        // success path — reads 0 here.
        ESP_LOGW(LOG_TAG, "Autotune timed out (no inflection within %.1f s) — gains preserved", autotuner->getTimeOut());
        if (autotune_fail_callback) {
            autotune_fail_callback();
        }
        return;
    }

    // Disturbance feedforward (output units per watt of heat loss). With
    // TUNER_OUTPUT_SPAN=1000 and a known heater wattage, "1 watt of
    // compensation maps to (1000 / wattage) PWM duty units". 0 when wattage
    // wasn't supplied — preserves prior no-disturbance-FF behaviour.
    // Variable name avoids shadowing the Heater member combinedKff (Sonar
    // cpp:S1117).
    const float kffFromWattage = autotuneHeaterWattage > 0 ? TUNER_OUTPUT_SPAN / static_cast<float>(autotuneHeaterWattage) : 0.0f;

    pid_callback(autotuner->getKp() * 1000.0f, autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f, kffFromWattage,
                 autotuner->getSystemDelay(), autotuner->getSystemGain(), autotuner->getSystemTau2());

    setTunings(autotuner->getKp() * 1000.0f, autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f);
    setFeedforwardScale(kffFromWattage);

    ESP_LOGI(LOG_TAG, "Autotuning finished: Kp=%.4f, Ki=%.4f, Kd=%.4f, Kff=%.4f", autotuner->getKp() * 1000.0f,
             autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f, kffFromWattage);
    // Setpoint-FF (SIMC's 1/k') logged for diagnostics — currently unrouted
    // (SimplePID gainFF stays 0); useful for sanity-checking the identifier
    // without affecting the runtime FF path that uses kffFromWattage above.
    ESP_LOGI(LOG_TAG, "SIMC params: L=%.2fs k'=%.4f°C/s tau2=%.2fs fc=%.4fHz wattage=%dW setpoint_FF=%.2f",
             autotuner->getSystemDelay(), autotuner->getSystemGain(), autotuner->getSystemTau2(), autotuner->getCrossoverFreq(),
             autotuneHeaterWattage, autotuner->getKff() * 1000.0f);
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
        ESP_LOGI(LOG_TAG, "PID Plot: output=%.2f, input=%.2f, setpoint=%.2f", optimumOutput * outputScale, temperature, setpoint);
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
    if (tempDelta <= 0.0f)
        return 0.0f;

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
