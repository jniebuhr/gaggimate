#include "DistanceSensor.h"

DistanceSensor::DistanceSensor(TwoWire *wire, distance_callback_t callback) : i2c(wire), _callback(callback) {
    this->tof = new VL53L0X();
}

void DistanceSensor::setup() {
    this->tof->setAddress(0x7E);
    this->tof->setBus(i2c);
    this->tof->setTimeout(1000);
    if (!this->tof->init()) {
        ESP_LOGE("DistanceSensor", "Failed to initialize VL53L0X");
    } else {
        this->tof->startContinuous(250);
        xTaskCreate(loopTask, "DistanceSensor::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
    }
}

void DistanceSensor::loop() {
    int millis = tof->readRangeContinuousMillimeters();
    if (tof->timeoutOccurred()) {
        ESP_LOGE("DistanceSensor", "ToF Timeout");
        return;
    }
    currentMillis = currentMillis * 0.99 + millis * 0.01;
    measurements = (measurements + 1) % 25;
    if (measurements == 0) {
        _callback(currentMillis);
    }
    ESP_LOGV("DistanceSensor", "Received measurement: %d (%d objects)", currentMillis, objects);
}

void DistanceSensor::loopTask(void *arg) {
    auto *sensor = static_cast<DistanceSensor *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        sensor->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(500));
    }
}
