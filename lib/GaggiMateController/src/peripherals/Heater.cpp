#include "Heater.h"
#include <Arduino.h>
#include <algorithm> 


Heater::Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
               const pid_result_callback_t &pid_callback, PIDLibrary library)
    : _library(library), sensor(sensor), heaterPin(heaterPin), taskHandle(nullptr), error_callback(error_callback),
      pid_callback(pid_callback) {
    if (_library == PIDLibrary::Legacy) {
        pid = new QuickPID(&temperature, &output, &setpoint);
        tuner = new PIDAutotuner();
    } else {
        simplePid = new SimplePID(&output, &temperature, &setpoint);
        autotuner = new Autotune();
    }
}

void Heater::setup() {
    pinMode(heaterPin, OUTPUT);
    setupPid();
    xTaskCreate(loopTask, "Heater::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void Heater::setupPid() {
    if (_library == PIDLibrary::Legacy) {
        pid->SetOutputLimits(0, TUNER_OUTPUT_SPAN);
        pid->SetSampleTimeUs((TUNER_OUTPUT_SPAN - 1) * 1000);
        pid->SetMode(QuickPID::Control::automatic);
        pid->SetProportionalMode(QuickPID::pMode::pOnError);
        pid->SetDerivativeMode(QuickPID::dMode::dOnMeas);
        pid->SetAntiWindupMode(QuickPID::iAwMode::iAwClamp);
        pid->SetTunings(Kp, Ki, Kd);
    } else {
        simplePid->setSamplingFrequency(TUNER_OUTPUT_SPAN / 1000.0f);
        simplePid->setCtrlOutputLimits(0.0f, TUNER_OUTPUT_SPAN);
        simplePid->activateSetPointFilter(true);
        simplePid->activateFeedForward(true);
        simplePid->reset();
    }
}

void Heater::setupAutotune(int tuningTemp, int samples) {
    if (_library == PIDLibrary::Legacy) {
        pid->Initialize();
        pid->SetMode(QuickPID::Control::manual);
        tuner->setOutputRange(0, TUNER_OUTPUT_SPAN);
        tuner->setTargetInputValue(tuningTemp);
        tuner->setTuningCycles(samples);
        tuner->setLoopInterval((TUNER_OUTPUT_SPAN - 1) * 1000);
        tuner->setZNMode(PIDAutotuner::ZNModeLessOvershoot);
    } else {
        autotuner->setWindowsize(samples);
        autotuner->setEpsilon(0.1f);
        autotuner->setRequiredConfirmations(3);
        autotuner->setTuningGoal(tuningTemp);
        autotuner->reset();
    }
}

void Heater::loop() {
    if (temperature <= 0.0f || setpoint <= 0.0f) {
        if (_library == PIDLibrary::Nimrod)
            simplePid->setMode(SimplePID::Control::manual);
        if (_library == PIDLibrary::Legacy)
            pid->SetMode(QuickPID::Control::manual);
        digitalWrite(heaterPin, LOW);
        relayStatus = false;
        temperature = sensor->read();
        return;
    }
    if (_library == PIDLibrary::Nimrod)
        simplePid->setMode(SimplePID::Control::automatic);
    if (_library == PIDLibrary::Legacy)
        pid->SetMode(QuickPID::Control::automatic);

    if (autotuning) {
        loopAutotune();
    } else {
        loopPid();
    }
}

void Heater::setSetpoint(float setpoint) {
    if (this->setpoint != setpoint) {
        this->setpoint = setpoint;
        ESP_LOGV(LOG_TAG, "Set setpoint %f°C", setpoint);
    }
}

void Heater::setTunings(float Kp, float Ki, float Kd) {
    if (_library == PIDLibrary::Legacy) {
        if (pid->GetKp() != Kp || pid->GetKi() != Ki || pid->GetKd() != Kd) {
            pid->SetTunings(Kp, Ki, Kd);
            pid->SetMode(QuickPID::Control::manual);
            pid->SetMode(QuickPID::Control::automatic);
            ESP_LOGI(LOG_TAG, "Set tunings to Kp: %f, Ki: %f, Kd: %f", Kp, Ki, Kd);
        }
    } else {
        if (simplePid->getKp() != Kp || simplePid->getKi() != Ki || simplePid->getKd() != Kd) {
            simplePid->setControllerPIDGains(Kp, Ki, Kd, simplePid->getKFF());
            simplePid->reset();
            ESP_LOGI(LOG_TAG, "Set tunings to Kp: %f, Ki: %f, Kd: %f", Kp, Ki, Kd);
        }
    }
}

void Heater::autotune(int testTime, int samples) {
    setupAutotune(testTime, samples);
    autotuning = true;
}

void Heater::loopPid() {
    softPwm(TUNER_OUTPUT_SPAN);
    temperature = sensor->read();
    if (_library == PIDLibrary::Legacy) {
        if (pid->Compute()) {
            plot(output, 1.0f, 3);
        }
    } else {
        if (simplePid->update()) {
            plot(output, 1.0f, 1);
        }
    }
}

void Heater::loopAutotune() {
    if (_library == PIDLibrary::Legacy) {
        loopAutotuneLegacy();
    } else {
        loopAutotuneNimrod();
    }
}

void Heater::loopAutotuneLegacy() {
    tuner->startTuningLoop(micros());
    long microseconds;
    long loopInterval = (static_cast<long>(TUNER_OUTPUT_SPAN) - 1L) * 1000L;
    while (!tuner->isFinished()) {
        microseconds = micros();
        temperature = sensor->read();
        output = tuner->tunePID(temperature, microseconds);
        softPwm(TUNER_OUTPUT_SPAN);
        plot(output, 1.0f, 3);
        while (micros() - microseconds < loopInterval) {
            softPwm(TUNER_OUTPUT_SPAN);
            vTaskDelay(1 / portTICK_PERIOD_MS);
        }
    }
    output = 0;
    softPwm(TUNER_OUTPUT_SPAN);
    pid_callback(tuner->getKp(), tuner->getKi(), tuner->getKd());
    setTunings(tuner->getKp(), tuner->getKi(), tuner->getKd());
    autotuning = false;
}

void Heater::loopAutotuneNimrod() {
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
    }
    output = 0.0f;
    autotuning = false;
    softPwm(TUNER_OUTPUT_SPAN);
    
    pid_callback(autotuner->getKp() * 1000.0f, autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f);

    setTunings(autotuner->getKp() * 1000.0f, autotuner->getKi() * 1000.0f, autotuner->getKd() * 1000.0f);
    simplePid->computeSetpointDelay(autotuner->getSystemDelay());
    simplePid->setKFF(autotuner->getKff()*1000);
    simplePid->setMode(SimplePID::Control::automatic);
        
    simplePid->setSetpointRateLimits(-INFINITY, autotuner->getSystemGain() * 0.8);
    simplePid->setSetpointFilterFrequency(autotuner->getCrossoverFreq()/2);
    
    ESP_LOGI(LOG_TAG, "Autotuning finished: Kp=%.4f, Ki=%.4f, Kd=%.4f, Kff=%.4f\n", autotuner->getKp()*1000.0f, autotuner->getKi()*1000.0f, autotuner->getKd()*1000.0f, autotuner->getKff()*1000.0f);
    ESP_LOGI(LOG_TAG, "System delay: %.2f s, System gain: %.4f Setpoint Freq: %.4f Hz\n", autotuner->getSystemDelay(), autotuner->getSystemGain(), autotuner->getCrossoverFreq()/2);
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
        ESP_LOGI(LOG_TAG, "Setpoint: %.2f, Input: %.2f, Output: %.2f, Kp: %.2f, Ki: %.2f, Kd: %.2f, Filtered Setpoint: %.2f", setpoint, temperature, optimumOutput * outputScale, simplePid->getKp(), simplePid->getKi(), simplePid->getKd(), simplePid->getSetpointFiltered());
    } else
        plotCount++;
}

void Heater::loopTask(void *arg) {
    auto *heater = static_cast<Heater *>(arg);
    while (true) {
        heater->loop();
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}
