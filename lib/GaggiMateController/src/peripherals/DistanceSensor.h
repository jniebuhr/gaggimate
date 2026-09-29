#ifndef DISTANCESENSOR_H
#define DISTANCESENSOR_H

#include "SoftWireBus.h"
#include <Arduino.h>
#include <VL35L0X/VL53L0X.h>

using distance_callback_t = std::function<void(int)>;

class DistanceSensor {
  public:
    DistanceSensor(SoftWireBus *bus, distance_callback_t callback);
    void setup();
    bool isHealthy() const { return healthy; }

  private:
    void loop();
    bool initSensor();
    bool readRange(uint16_t &range);
    bool checkIdentity();
    void recover();

    SoftWireBus *bus;
    VL53L0X *tof;
    xTaskHandle taskHandle;
    distance_callback_t _callback;
    int measurements = 0;
    int currentMillis = 0;

    bool healthy = false;
    uint8_t failures = 0;
    uint8_t staleReads = 0;
    uint8_t pollsSinceIdentityCheck = 0;
    unsigned long lastRecovery = 0;
    unsigned long recoveryBackoff = 0;

    const char *LOG_TAG = "DistanceSensor";
    static void loopTask(void *arg);
};

#endif // DISTANCESENSOR_H
