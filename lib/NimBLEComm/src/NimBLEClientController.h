#ifndef NIMBLECLIENTCONTROLLER_H
#define NIMBLECLIENTCONTROLLER_H

#include "NimBLEComm.h"
#include "cstring"

class NimBLEClientController : public NimBLEAdvertisedDeviceCallbacks, NimBLEClientCallbacks {
  public:
    NimBLEClientController();
    void initClient();
    bool connectToServer();
    void loop();

    void sendAdvancedOutputControl(bool valve, float heaterSetpoint, bool pressureTarget, float pressure, float flow, bool refill,
                                   float heater2Setpoint);

    void sendOutputControl(bool valve, float pumpSetpoint, float boilerSetpoint, bool refill, float heater2Setpoint);
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
    void registerLevelCallback(const bool_callback_t &callback);
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
    NimBLERemoteCharacteristic *levelChar = nullptr;
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

    remote_err_callback_t remoteErrorCallback = nullptr;
    button_callback_t btnCallback = nullptr;
    bool_callback_t steamBtnCallback = nullptr;
    bool_callback_t levelCallback = nullptr;
    pid_control_callback_t autotuneResultCallback = nullptr;
    sensor_read_callback_t sensorCallback = nullptr;
    float_callback_t volumetricMeasurementCallback = nullptr;
    int_callback_t tofMeasurementCallback = nullptr;
    void_callback_t disconnectCallback = nullptr;

    String _lastOutputControl = "";
    char advancedOutputBuffer[90]{};
    char outputBuffer[64]{};
    char autotuneBuffer[24]{};
    char pressureScaleBuffer[10]{};

    // BLEAdvertisedDeviceCallbacks override
    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;

    // NimBLEClientCallbacks override
    void onDisconnect(NimBLEClient *pServer) override;

    // Notification callback
    void notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify) const;

    const char *LOG_TAG = "NimBLEClientController";
    static void loopTask(void *arg);
};

#endif // NIMBLECLIENTCONTROLLER_H
