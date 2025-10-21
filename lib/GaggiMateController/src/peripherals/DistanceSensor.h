#ifndef DISTANCESENSOR_H
#define DISTANCESENSOR_H

#include <Arduino.h>
#include <VL53L0X.h>
#include <Wire.h>

using distance_callback_t = std::function<void(int)>;

class DistanceSensor {
public:
  DistanceSensor(TwoWire *wire, distance_callback_t callback);
  void setup();

private:
  void loop();

  TwoWire *i2c;
  VL53L0X *tof;
  xTaskHandle taskHandle;
  distance_callback_t _callback;
  int measurements = 0;
  int currentMillis = 0;

  const char *LOG_TAG = "DistanceSensor";
  static void loopTask(void *arg);
};

#endif // DISTANCESENSOR_H
