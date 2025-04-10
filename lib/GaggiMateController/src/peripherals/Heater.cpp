#include "Heater.h"
#include <Arduino.h>

Heater::Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback,
               const pid_result_callback_t &pid_callback)
    : sensor(sensor), heaterPin(heaterPin), taskHandle(nullptr), error_callback(error_callback), pid_callback(pid_callback) {
    pid = new QuickPID(&temperature, &output, &setpoint);
    tuner = new PIDAutotuner();

    output = 0.0f;
}

void Heater::setup() {
    pinMode(heaterPin, OUTPUT);
    setupPid();
    xTaskCreate(loopTask, "Heater::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void Heater::setupPid() {
    pid->SetOutputLimits(0, TUNER_OUTPUT_SPAN);
    pid->SetSampleTimeUs((TUNER_OUTPUT_SPAN - 1) * 1000);
    pid->SetMode(QuickPID::Control::automatic);
    pid->SetProportionalMode(QuickPID::pMode::pOnError);
    pid->SetDerivativeMode(QuickPID::dMode::dOnMeas);
    pid->SetAntiWindupMode(QuickPID::iAwMode::iAwClamp);
    pid->SetTunings(Kp, Ki, Kd);
}

void Heater::setupAutotune(int tuningTemp, int samples) {
    pid->Initialize();
    pid->SetMode(QuickPID::Control::manual);
    tuner->setOutputRange(0, TUNER_OUTPUT_SPAN);
    tuner->setTargetInputValue(tuningTemp);
    tuner->setTuningCycles(samples);
    tuner->setLoopInterval((TUNER_OUTPUT_SPAN - 1) * 1000);
    tuner->setZNMode(PIDAutotuner::ZNModeLessOvershoot);
}

void Heater::loop() {
    if (temperature <= 0 || setpoint <= 0) {
        digitalWrite(heaterPin, LOW);
        temperature = sensor->read();
        return;
    }

    if (autotuning) {
        loopAutotune();
    } else {
        loopPid();
    }
}

void Heater::setSetpoint(float setpoint) {
    if (this->setpoint != setpoint) {
        this->setpoint = setpoint;
        pid->SetMode(QuickPID::Control::manual);
        pid->SetMode(QuickPID::Control::automatic);
        ESP_LOGV(LOG_TAG, "Set setpoint %f°C", setpoint);
    }
}

void Heater::setTunings(float Kp, float Ki, float Kd) {
    if (pid->GetKp() != Kp || pid->GetKi() != Ki || pid->GetKd() != Kd) {
        pid->SetTunings(Kp, Ki, Kd);
        pid->SetMode(QuickPID::Control::manual);
        pid->SetMode(QuickPID::Control::automatic);
        ESP_LOGV(LOG_TAG, "Set tunings to Kp: %f, Ki: %f, Kd: %f", Kp, Ki, Kd);
    }
}

void Heater::autotune(int testTime, int samples) {
    setupAutotune(testTime, samples);
    autotuning = true;
}

void Heater::loopPid() {
    softPwm(TUNER_OUTPUT_SPAN, 1);
    if (pid->Compute()) {
        temperature = sensor->read();
        plot(output, 1.0f, 3);
    }
}

void Heater::loopAutotune() {
    tuner->startTuningLoop(micros());
    long microseconds;
    long loopInterval = (static_cast<long>(TUNER_OUTPUT_SPAN) - 1L) * 1000L;
    while (!tuner->isFinished()) {
        microseconds = micros();
        temperature = sensor->read();
        output = tuner->tunePID(temperature, microseconds);
        softPwm(TUNER_OUTPUT_SPAN, 1);
        plot(output, 1.0f, 3);
        while (micros() - microseconds < loopInterval) {
            softPwm(TUNER_OUTPUT_SPAN, 1);
            vTaskDelay(1 / portTICK_PERIOD_MS);
        }
    }
    output = 0;
    softPwm(TUNER_OUTPUT_SPAN, 1);
    pid_callback(tuner->getKp(), tuner->getKi(), tuner->getKd());
    setTunings(tuner->getKp(), tuner->getKi(), tuner->getKd());
    autotuning = false;
}

float Heater::softPwm(uint32_t windowSize, uint8_t debounce) {
    // software PWM timer
    uint32_t msNow = millis();
    static uint32_t windowStartTime, nextSwitchTime;
    if (msNow - windowStartTime >= windowSize) {
        windowStartTime = msNow;
    }
    // SSR optimum AC half-cycle controller
    /*
    static float optimumOutput;
    static bool reachedSetpoint;

    if (temperature > setpoint) reachedSetpoint = true;
    if (reachedSetpoint && !debounce && setpoint > 0 && temperature > setpoint) optimumOutput = output - 8;
    else if (reachedSetpoint && !debounce && setpoint > 0 && temperature < setpoint) optimumOutput = output + 8;
    else  optimumOutput = output;
    if (optimumOutput < 0) optimumOutput = 0;
    */

    float optimumOutput = output;

    // PWM relay output
    static bool relayStatus;
    if (!relayStatus && optimumOutput > (msNow - windowStartTime)) {
        if (msNow > nextSwitchTime) {
            nextSwitchTime = msNow + debounce;
            relayStatus = true;
            digitalWrite(heaterPin, HIGH);
        }
    } else if (relayStatus && optimumOutput < (msNow - windowStartTime)) {
        if (msNow > nextSwitchTime) {
            nextSwitchTime = msNow + debounce;
            relayStatus = false;
            digitalWrite(heaterPin, LOW);
        }
    }
    return optimumOutput;
}

void Heater::plot(float optimumOutput, float outputScale, uint8_t everyNth) {
    if (plotCount >= everyNth) {
        plotCount = 1;
        ESP_LOGI("sTune", "Setpoint: %.2f, Input: %.2f, Output: %.2f", setpoint, temperature, optimumOutput * outputScale);
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
