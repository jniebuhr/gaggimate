#ifndef GAGGIMATECONTROLLER_H
#define GAGGIMATECONTROLLER_H
#include "ControllerConfig.h"
#include "NimBLEServerController.h"
#include <peripherals/DigitalInput.h>
#include <peripherals/DistanceSensor.h>
#include <peripherals/Heater.h>
#include <peripherals/LedController.h>
#include <peripherals/Max31855Thermocouple.h>
#include <peripherals/PressureSensor.h>
#include <peripherals/Pump.h>
#include <peripherals/SimpleRelay.h>
#include <vector>

constexpr double PING_TIMEOUT_SECONDS = 20.0;

constexpr int DETECT_EN_PIN = 40;
constexpr int DETECT_VALUE_PIN = 11;

class GaggiMateController {
  public:
    GaggiMateController(String version);
    void setup(void);
    void loop(void);

    void registerBoardConfig(ControllerConfig config);

  private:
    void detectBoard();
    void detectAddon();
    void handlePing();
    void handlePingTimeout(void);
    void thermalRunawayShutdown(void);
    void startPidAutotune(void);
    void stopPidAutotune(void);
    void sendSensorData(void);
    void handleSerialCommand(char c);

    // Button hold detection for pairing mode
    void handleBrewButtonState(bool pressed);
    void handleSteamButtonState(bool pressed);
    void handleBootButtonState(bool pressed);
    void checkPairingButtonPress();

    bool brewButtonHeld = false;
    unsigned long brewButtonHoldStart = 0;
    bool steamButtonHeld = false;
    unsigned long steamButtonHoldStart = 0;
    const unsigned long PAIRING_BUTTON_HOLD_MS = 5000;
    const unsigned long CLEAR_BONDS_HOLD_MS = 10000;

    portMUX_TYPE buttonMux = portMUX_INITIALIZER_UNLOCKED; // Spinlock for button state

    ControllerConfig _config = ControllerConfig{};
    NimBLEServerController _ble;

    Max31855Thermocouple *thermocouple = nullptr;
    Heater *heater = nullptr;
    SimpleRelay *valve = nullptr;
    SimpleRelay *alt = nullptr;
    Pump *pump = nullptr;
    DigitalInput *brewBtn = nullptr;
    DigitalInput *steamBtn = nullptr;
    DigitalInput *bootBtn = nullptr;  // GPIO0 fallback for pairing confirmation
    PressureSensor *pressureSensor = nullptr;
    LedController *ledController = nullptr;
    DistanceSensor *distanceSensor = nullptr;

    std::vector<ControllerConfig> configs;

    String _version;
    unsigned long lastPingTime = 0;
    size_t errorState = ERROR_CODE_NONE;

    const char *LOG_TAG = "GaggiMateController";
};

#endif // GAGGIMATECONTROLLER_H
