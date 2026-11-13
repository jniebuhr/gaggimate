#ifndef GAGGIMATECONTROLLER_H
#define GAGGIMATECONTROLLER_H
#include "ControllerConfig.h"
#include "GaggiMateServer.h"
#include <array>
#include <atomic>
#include <freertos/queue.h>
#include <memory>
#include <peripherals/DigitalInput.h>
#include <peripherals/DistanceSensor.h>
#include <peripherals/FlowSensor.h>
#include <peripherals/HardwareScale.h>
#include <peripherals/Heater.h>
#include <peripherals/HeaterCoordinator.h>
#include <peripherals/LedController.h>
#include <peripherals/Max31855Thermocouple.h>
#include <peripherals/PressureSensor.h>
#include <peripherals/Pump.h>
#include <peripherals/PwmLight.h>
#include <peripherals/SimpleRelay.h>
#include <peripherals/addons/GearpumpAddon.h>
#include <vector>

constexpr double PING_TIMEOUT_SECONDS = 20.0;
constexpr unsigned long LED_HEALTH_CHECK_INTERVAL_MS = 5000;
constexpr unsigned long TANK_LEVEL_SEND_INTERVAL_MS = 5000;

constexpr int DETECT_EN_PIN = 40;
constexpr int DETECT_VALUE_PIN = 11;

class GaggiMateController {
  public:
    explicit GaggiMateController(String version);
    void setup(void);
    void loop(void);

    void registerBoardConfig(ControllerConfig config);

  private:
    void clearRetainedOutputDemands();
    void detectBoard();
    void detectAddon();
    void loadMachineHardware();
    void storeMachineHardware(const gm::MachineHardwareSettings &settings);
    void updateDualBoilerOutputs(unsigned long now);
    void handlePing();
    void handlePingTimeout(void);
    void stopOutputs();
    void thermalRunawayShutdown(void);
    void startPidAutotune(void);
    void stopPidAutotune(void);
    void sendSensorData(void);
    void sendTankLevel();
    void handleSerialCommand(char c);
    bool isBondingSwitchOn() const;

    ControllerConfig _config = ControllerConfig{};
    GaggiMateServer _comms;

    std::unique_ptr<TemperatureSensor> brewTemperature;
    std::unique_ptr<TemperatureSensor> steamTemperature;
    std::unique_ptr<Heater> heater;
    std::unique_ptr<Heater> heater2;
    std::unique_ptr<HeaterCoordinator> heaterCoordinator;
    std::unique_ptr<Pump> pump;
    std::unique_ptr<SimpleRelay> valve;
    std::unique_ptr<SimpleRelay> alt;
    std::unique_ptr<SimpleRelay> refill;
    std::unique_ptr<SimpleRelay> aux;
    std::unique_ptr<PwmLight> lights;
    std::unique_ptr<PwmLight> baristaLight;
    std::unique_ptr<DigitalInput> brewBtn;
    std::unique_ptr<DigitalInput> steamBtn;
    std::unique_ptr<DigitalInput> waterBtn;
    std::unique_ptr<DigitalInput> waterSense;
    std::unique_ptr<DigitalInput> tankLevel;
    std::atomic<bool> steamLevelLow{true};
    std::atomic<bool> steamLevelKnown{false};
    std::atomic<bool> tankLevelOK{false};
    std::atomic<float> steamRequestedSetpoint{0.0f};
    unsigned long lastSensorSend = 0;
    std::unique_ptr<PressureSensor> pressureSensor;
    std::unique_ptr<LedController> ledController;
    std::unique_ptr<DistanceSensor> distanceSensor;
    QueueHandle_t hardwareRequests = nullptr;
    std::atomic<bool> controllerErrorPending{false};
    std::atomic<bool> hardwareSessionReady{false};
    bool hardwareConfigurationError = false;
    bool hardwareConfigurationStored = false;
    bool hardwareConfigurationAccepted = false;
    gm::MachineHardwareSettings machineHardware = gaggimate_MachineHardwareSettings_init_zero;
    std::unique_ptr<ADSAdc> adc;
    std::unique_ptr<FlowSensor> flowSensor;
    std::unique_ptr<HardwareScale> hardwareScale;

    std::unique_ptr<GearpumpAddon> gearpumpAddon;

    std::array<char, 128> albaSwTxBuffer{};
    std::array<char, 128> albaSwRxBuffer{};
    std::unique_ptr<SoftWire> albaComms;
    std::unique_ptr<SoftWireBus> albaBus;

    std::vector<ControllerConfig> configs;

    String _version;
    unsigned long lastPingTime = 0;
    unsigned long lastLedHealthCheck = 0;
    unsigned long lastTankLevelSend = 0;
    size_t errorState = ERROR_CODE_NONE;

    const char *LOG_TAG = "GaggiMateController";
};

#endif // GAGGIMATECONTROLLER_H
