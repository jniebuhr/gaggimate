#ifndef DISTANCESENSOR_H
#define DISTANCESENSOR_H

#include <Arduino.h>
#include <SoftWire.h>
#include <VL35L0X/VL53L0X.h>

using distance_callback_t = std::function<void(int)>;

class DistanceSensor {
  public:
    DistanceSensor(SoftWire *wire, distance_callback_t callback);
    void setup();

  private:
    void loop();

    SoftWire *i2c;
    VL53L0X *tof;
    xTaskHandle taskHandle;
    distance_callback_t _callback;
    int measurements = 0;
    int currentMillis = 0;

    const char *LOG_TAG = "DistanceSensor";
    static void loopTask(void *arg);
};

#endif // DISTANCESENSOR_H
