#ifndef NIMBLECLIENTCONTROLLER_H
#define NIMBLECLIENTCONTROLLER_H

#include "NimBLEComm.h"
#include "cstring"
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

class NimBLEClientController : public NimBLEAdvertisedDeviceCallbacks, NimBLEClientCallbacks {
  public:
    NimBLEClientController();
    void initClient();
    bool connectToServer();
    void loop();

    // Drains BLE callback work from application context instead of the NimBLE task.
    void dispatchPendingEvents();

    void sendAdvancedOutputControl(bool valve, float boilerSetpoint, bool pressureTarget, float pressure, float flow);

    void sendOutputControl(bool valve, float pumpSetpoint, float boilerSetpoint);
    void sendAltControl(bool pinState);
    void sendPing();
    void sendAutotune(int testTime, int samples);
    void sendPidSettings(const String &pid);
    void sendPumpModelCoeffs(const String &pumpModelCoeffs);
    void setPressureScale(float scale);
    void sendLedControl(uint8_t channel, uint8_t brightness);
    bool isReadyForConnection() const;
    bool isConnected();
    void scan();
    void tare();
    void registerRemoteErrorCallback(const remote_err_callback_t &callback);
    void registerBtnCallback(const button_callback_t &callback);
    void registerSensorCallback(const sensor_read_callback_t &callback);
    void registerAutotuneResultCallback(const pid_control_callback_t &callback);
    void registerVolumetricMeasurementCallback(const float_callback_t &callback);
    void registerTofMeasurementCallback(const int_callback_t &callback);
    void registerDisconnectCallback(const void_callback_t &callback);
    std::string readInfo() const;
    NimBLEClient *getClient() const { return client; };

  private:
    NimBLEClient *client;
    NimBLEScan *scanner;

    NimBLERemoteCharacteristic *tempControlChar = nullptr;
    NimBLERemoteCharacteristic *pumpControlChar = nullptr;
    NimBLERemoteCharacteristic *valveControlChar = nullptr;
    NimBLERemoteCharacteristic *altControlChar = nullptr;
    NimBLERemoteCharacteristic *tempReadChar = nullptr;
    NimBLERemoteCharacteristic *pingChar = nullptr;
    NimBLERemoteCharacteristic *pidControlChar = nullptr;
    NimBLERemoteCharacteristic *pumpModelCoeffsChar = nullptr;
    NimBLERemoteCharacteristic *errorChar = nullptr;
    NimBLERemoteCharacteristic *autotuneChar = nullptr;
    NimBLERemoteCharacteristic *autotuneResultChar = nullptr;
    NimBLERemoteCharacteristic *btnChar = nullptr;
    NimBLERemoteCharacteristic *infoChar = nullptr;
    NimBLERemoteCharacteristic *sensorChar = nullptr;
    NimBLERemoteCharacteristic *outputControlChar = nullptr;
    NimBLERemoteCharacteristic *pressureScaleChar = nullptr;
    NimBLERemoteCharacteristic *volumetricMeasurementChar = nullptr;
    NimBLERemoteCharacteristic *volumetricTareChar = nullptr;
    NimBLERemoteCharacteristic *ledControlChar = nullptr;
    NimBLERemoteCharacteristic *tofMeasurementChar = nullptr;
    NimBLEAdvertisedDevice *serverDevice = nullptr;
    bool readyForConnection = false;
    xTaskHandle taskHandle;

    // One MTU-sized notification payload plus a null terminator for existing parsers.
    static constexpr size_t PENDING_EVENT_PAYLOAD_SIZE = 129;

    // Keep a short backlog without letting callback data grow unbounded.
    static constexpr size_t PENDING_EVENT_QUEUE_LENGTH = 32;

    // Bound dispatch work so Controller::loop() cannot spend a full pass draining BLE events.
    static constexpr size_t MAX_PENDING_EVENTS_PER_DISPATCH = 8;

    // Events copied out of NimBLE callbacks and replayed by dispatchPendingEvents().
    enum class PendingEventType : uint8_t {
        RemoteError,
        Button,
        SensorData,
        AutotuneResult,
        VolumetricMeasurement,
        TofMeasurement,
        Disconnect,
        Unknown,
    };

    struct PendingEvent {
        PendingEventType type = PendingEventType::Unknown;
        char payload[PENDING_EVENT_PAYLOAD_SIZE]{};
    };

    QueueHandle_t pendingEventQueue = nullptr;

    remote_err_callback_t remoteErrorCallback = nullptr;
    button_callback_t btnCallback = nullptr;
    pid_control_callback_t autotuneResultCallback = nullptr;
    sensor_read_callback_t sensorCallback = nullptr;
    float_callback_t volumetricMeasurementCallback = nullptr;
    int_callback_t tofMeasurementCallback = nullptr;
    void_callback_t disconnectCallback = nullptr;

    String _lastOutputControl = "";
    char advancedOutputBuffer[80]{};
    char outputBuffer[64]{};
    char autotuneBuffer[24]{};
    char pressureScaleBuffer[10]{};

    // BLEAdvertisedDeviceCallbacks override
    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;

    // NimBLEClientCallbacks override
    void onDisconnect(NimBLEClient *pServer) override;

    // Notification callback
    void notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify);

    // Store a small enum in the queue instead of a NimBLE characteristic pointer.
    PendingEventType getPendingEventType(NimBLERemoteCharacteristic *pRemoteCharacteristic) const;

    // Must remain non-blocking and must not invoke application callbacks.
    bool enqueuePendingEvent(PendingEventType type, const uint8_t *data = nullptr, size_t length = 0);

    // Replays the original notification handling after leaving NimBLE callback context.
    void dispatchPendingEvent(const PendingEvent &event);

    const char *LOG_TAG = "NimBLEClientController";
    static void loopTask(void *arg);
};

#endif // NIMBLECLIENTCONTROLLER_H
