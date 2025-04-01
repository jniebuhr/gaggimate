#include "Heater.h"
#include <Arduino.h>

Heater::Heater(TemperatureSensor *sensor, uint8_t heaterPin, const heater_error_callback_t &error_callback)
    : sensor(sensor), heaterPin(heaterPin), taskHandle(nullptr), error_callback(error_callback) {
    pid = new QuickPID(&temperature, &output, &setpoint);
    tune = new sTune(&temperature, &output, sTune::ZN_PID, sTune::directIP, sTune::printSUMMARY);

    output = 0.0f;
}

void Heater::setup() {
    pinMode(heaterPin, OUTPUT);
    setupAutotune();
    xTaskCreate(loopTask, "Heater::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void Heater::setupPid() {
    tune->Configure(0, 0, 0, 0, TEST_TIME_SEC, 0, TUNER_SAMPLES);
    pid->SetOutputLimits(0, TUNER_OUTPUT_SPAN);
    pid->SetSampleTimeUs((TUNER_OUTPUT_SPAN - 1) * 1000);
    pid->SetMode(QuickPID::Control::automatic);
    pid->SetProportionalMode(QuickPID::pMode::pOnMeas);
    pid->SetAntiWindupMode(QuickPID::iAwMode::iAwClamp);
    pid->SetTunings(Kp, Ki, Kd);
}

void Heater::setupAutotune() {
    tune->Configure(TUNER_INPUT_SPAN, TUNER_OUTPUT_SPAN, outputStart, outputStep, TEST_TIME_SEC_AUTOTUNE, SETTLE_TIME_SEC_AUTOTUNE, TUNER_SAMPLES_AUTOTUNE);
    tune->SetEmergencyStop(120);
}

void Heater::loop() {
    if (temperature <= 0 || setpoint <= 0) {
        digitalWrite(heaterPin, LOW);
        temperature = sensor->read();
        return;
    }

    loopAutotune();
}

void Heater::setSetpoint(float setpoint) {
    this->setpoint = setpoint;
    ESP_LOGV(LOG_TAG, "Set setpoint %f°C", setpoint);
}

void Heater::setTunings(float Kp, float Ki, float Kd) {
    /*
    if (pid->GetKp() != Kp || pid->GetKi() != Ki || pid->GetKd() != Kd) {
        pid->SetTunings(Kp, Ki, Kd);
        ESP_LOGV(LOG_TAG, "Set tunings to Kp: %f, Ki: %f, Kd: %f", Kp, Ki, Kd);
    }
    */
}

void Heater::loopPid() {
    float optimumOutput = tune->softPwm(heaterPin, temperature, output, setpoint, TUNER_OUTPUT_SPAN, 0);
    if (pid->Compute()) {
        float rawTemp = sensor->read();
        temperature = 0.2 * rawTemp + 0.8 * temperature;
        tune->plotter(temperature, optimumOutput, setpoint, 0.1f, 3);
    }
}

void Heater::loopAutotune() {
    float rawTemp = 0;
    float optimumOutput = tune->softPwm(heaterPin, temperature, output, setpoint, TUNER_OUTPUT_SPAN, debounce);
    switch (tune->Run()) {
        case tune->sample: // active once per sample during test
            rawTemp = sensor->read();
            temperature = 0.2 * rawTemp + 0.8 * temperature;
            tune->plotter(temperature, output, setpoint, 0.1f, 3); // output scale 0.5, plot every 3rd sample
            break;
        case tune->tunings: // active just once when sTune is done
            tune->GetAutoTunings(&Kp, &Ki, &Kd); // sketch variables updated by sTune
            pid->SetOutputLimits(0, TUNER_OUTPUT_SPAN);
            pid->SetSampleTimeUs((TUNER_OUTPUT_SPAN - 1) * 1000);
            debounce = 0; // ssr mode
            output = outputStep;
            pid->SetMode(QuickPID::Control::automatic);
            pid->SetProportionalMode(QuickPID::pMode::pOnMeas);
            pid->SetAntiWindupMode(QuickPID::iAwMode::iAwClamp);
            pid->SetTunings(Kp, Ki, Kd);
            break;

        case tune->runPid: // active once per sample after tunings
            if (startup && temperature > setpoint - 5) { // reduce overshoot
                startup = false;
                output -= 9;
                pid->SetMode(QuickPID::Control::manual);
                pid->SetMode(QuickPID::Control::automatic);
            }
            rawTemp = sensor->read();
            temperature = 0.2 * rawTemp + 0.8 * temperature;
            pid->Compute();
            tune->plotter(temperature, optimumOutput, setpoint, 0.1f, 3);
            break;
    }
}

void Heater::loopTask(void *arg) {
    auto *heater = static_cast<Heater *>(arg);
    while (true) {
        heater->loop();
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}
