#include "DistanceSensor.h"

DistanceSensor::DistanceSensor(TwoWire *wire, distance_callback_t callback) : i2c(wire), _callback(callback) {
    this->tof = new VL53L3C();
}

void DistanceSensor::setup() {
    this->tof->begin(*i2c);
    tof->setDistanceMode(DIST_SHORT);
    tof->setTimingBudget(100000);
    tof->startMeasurement();
    tof->startNextMeasurement();
    xTaskCreate(loopTask, "DistanceSensor::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle);
}

void DistanceSensor::loop() {
    if (tof->dataIsReady()) {
        MeasurmentResult measResult;
        tof->getMeasurmentData(&measResult);
        int objects = measResult.numObjs;
        int sum = 0;
        int millis = 0;
        if (objects > 0) {
            for (int i = 0; i < objects; i++) {
                sum += measResult.rangeData[i].Range;
            }
            millis = sum / objects;
        }
        currentMillis = currentMillis * 0.8 + millis * 0.2;
        measurements = (measurements + 1) % 25;
        if (measurements == 0) {
            _callback(currentMillis);
        }
        ESP_LOGV("DistanceSensor", "Received measurement: %d (%d objects)", currentMillis, objects);
        tof->startNextMeasurement();
    }
}

void DistanceSensor::loopTask(void *arg) {
    auto *sensor = static_cast<DistanceSensor *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    while (true) {
        sensor->loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(50));
    }
}
