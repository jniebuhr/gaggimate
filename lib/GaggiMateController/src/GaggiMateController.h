#ifndef GAGGIMATECONTROLLER_H
#define GAGGIMATECONTROLLER_H
#include "ControllerConfig.h"
#include "NimBLEServerController.h"
#include "PID_AutoTune_v0.h"
#include "PID_v1.h"
#include <MAX31855.h>

constexpr size_t TEMP_UPDATE_INTERVAL_MS = 1000;
constexpr float PUMP_CYCLE_TIME = 5000.0f;
constexpr double MAX_SAFE_TEMP = 170.0;
constexpr double PING_TIMEOUT_SECONDS = 10.0;

class GaggiMateController {
public:
    GaggiMateController(ControllerConfig const &config = GM_CONTROLLER_REV_1x);
    void setup(void);
    void loop(void);

private:
    void controlHeater(int signal);
    void controlPump();
    void controlValve(bool state);
    void controlAlt(bool state);
    float readTemperature(void);
    void onTemperatureControl(float temperature);
    void onPumpControl(float setpoint);
    void handlePingTimeout(void);
    void thermalRunawayShutdown(void);
    void startPidAutotune(void);
    void stopPidAutotune(void);

    ControllerConfig const &_config;
    NimBLEServerController _ble;

    double setpoint = 0.0;
    double input = 0.0;
    double output = 0.0;
    bool isAutotuning = false;
    PID *pid = nullptr;
    PID_ATune *pidAutotune = nullptr;
    MAX31855 *max31855 = nullptr;

    long lastPingTime;
    unsigned long lastCycleStart = 0;
    float flowPercentage = 0;
    unsigned long lastTempUpdate = 0;
};

#endif //GAGGIMATECONTROLLER_H
