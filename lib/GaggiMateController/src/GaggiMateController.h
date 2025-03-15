#ifndef GAGGIMATECONTROLLER_H
#define GAGGIMATECONTROLLER_H
#include "ControllerConfig.h"
#include "NimBLEServerController.h"
#include "PID_AutoTune_v0.h"
#include "PID_v1.h"
#include <MAX31855.h>
#include <vector>

constexpr size_t TEMP_UPDATE_INTERVAL_MS = 1000;
constexpr float PUMP_CYCLE_TIME = 5000.0f;
constexpr double MAX_SAFE_TEMP = 170.0;
constexpr double PING_TIMEOUT_SECONDS = 10.0;

constexpr int DETECT_EN_PIN = 40;
constexpr int DETECT_VALUE_PIN = 11;

class GaggiMateController {
  public:
    GaggiMateController();
    void setup(void);
    void loop(void);

    void registerBoardConfig(ControllerConfig config);

  private:
    void detectBoard();
    void detectAddon();
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

    ControllerConfig _config = ControllerConfig{};
    NimBLEServerController _ble;

    std::vector<ControllerConfig> configs;

    double setpoint = 0.0;
    double input = 0.0;
    double output = 0.0;
    bool isAutotuning = false;
    PID *pid = nullptr;
    PID_ATune *pidAutotune = nullptr;
    MAX31855 *max31855 = nullptr;

    long lastPingTime = 0;
    unsigned long lastCycleStart = 0;
    float flowPercentage = 0;
    unsigned long lastTempUpdate = 0;
    bool steamButtonState = HIGH;
    bool brewButtonState = HIGH;
};

#endif // GAGGIMATECONTROLLER_H
