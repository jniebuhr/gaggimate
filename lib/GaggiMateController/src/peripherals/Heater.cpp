#include "Heater.h"
#include <Arduino.h>

Heater::Heater(TemperatureSensor *sensor, int heaterPin, const heater_error_callback_t &error_callback)
    : sensor(sensor), heaterPin(heaterPin), taskHandle(nullptr), error_callback(error_callback) {
    pid = new QuickPID(&temperature, &output, &setpoint);

    output = 0.0f;
    pid->SetOutputLimits(0, TUNER_OUTPUT_SPAN);
    pid->SetSampleTimeUs(250 * 1000);
    pid->SetMode(QuickPID::Control::automatic);
    pid->SetProportionalMode(QuickPID::pMode::pOnError);
    pid->SetDerivativeMode(QuickPID::dMode::dOnMeas);
    pid->SetAntiWindupMode(QuickPID::iAwMode::iAwClamp);
    pid->SetTunings(Kp, Ki, Kd);
}

void Heater::setup() {
    pinMode(heaterPin, OUTPUT);
    xTaskCreate(loopTask, "Heater::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void Heater::loop() {
    if (temperature == 0 || setpoint == 0) {
        digitalWrite(heaterPin, LOW);
        temperature = sensor->read();
        return;
    }

    if (pid->Compute()) {
        temperature = sensor->read();
        analogWrite(heaterPin, output);
    }
}

void Heater::setSetpoint(float setpoint) {
    this->setpoint = setpoint;
    ESP_LOGV(LOG_TAG, "Set setpoint %f°C", setpoint);
}

void Heater::setTunings(float Kp, float Ki, float Kd) {
    pid->SetTunings(Kp, Ki, Kd);
    ESP_LOGV(LOG_TAG, "Set tunings to Kp: %f, Ki: %f, Kd: %f", Kp, Ki, Kd);
}

void Heater::loopTask(void *arg) {
    auto *heater = static_cast<Heater *>(arg);
    while (true) {
        heater->loop();
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}
