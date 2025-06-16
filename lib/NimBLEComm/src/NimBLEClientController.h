#ifndef NIMBLECLIENTCONTROLLER_H
#define NIMBLECLIENTCONTROLLER_H

#include "NimBLEComm.h"
#include "cstring"

class NimBLEClientController : public NimBLEAdvertisedDeviceCallbacks, NimBLEClientCallbacks {
  public:
    NimBLEClientController();
    void initClient();
    bool connectToServer();

    void sendAdvancedOutputControl(bool valve, float boilerSetpoint, bool pressureTarget, float pressure, float flow);

    void sendOutputControl(bool valve, float pumpSetpoint, float boilerSetpoint);
    void sendAltControl(bool pinState);
    void sendPing();
    void sendAutotune(int testTime, int samples);
    void sendPidSettings(const String &pid);
    void setPressureScale(float scale);
    bool isReadyForConnection() const;
    bool isConnected();
    void scan();
    void tare();
    void registerRemoteErrorCallback(const remote_err_callback_t &callback);
    void registerBrewBtnCallback(const brew_callback_t &callback);
    void registerSteamBtnCallback(const steam_callback_t &callback);
    void registerSensorCallback(const sensor_read_callback_t &callback);
    void registerAutotuneResultCallback(const pid_control_callback_t &callback);
    void registerVolumetricMeasurementCallback(const float_callback_t &callback);
    std::string readInfo() const;
    NimBLEClient *getClient() const { return client; };

  private:
    NimBLEClient *client;

    NimBLERemoteCharacteristic *tempControlChar = nullptr;
    NimBLERemoteCharacteristic *pumpControlChar = nullptr;
    NimBLERemoteCharacteristic *valveControlChar = nullptr;
    NimBLERemoteCharacteristic *altControlChar = nullptr;
    NimBLERemoteCharacteristic *tempReadChar = nullptr;
    NimBLERemoteCharacteristic *pingChar = nullptr;
    NimBLERemoteCharacteristic *pidControlChar = nullptr;
    NimBLERemoteCharacteristic *errorChar = nullptr;
    NimBLERemoteCharacteristic *autotuneChar = nullptr;
    NimBLERemoteCharacteristic *autotuneResultChar = nullptr;
    NimBLERemoteCharacteristic *brewBtnChar = nullptr;
    NimBLERemoteCharacteristic *steamBtnChar = nullptr;
    NimBLERemoteCharacteristic *infoChar = nullptr;
    NimBLERemoteCharacteristic *sensorChar = nullptr;
    NimBLERemoteCharacteristic *outputControlChar = nullptr;
    NimBLERemoteCharacteristic *pressureScaleChar = nullptr;
    NimBLERemoteCharacteristic *volumetricMeasurementChar;
    NimBLERemoteCharacteristic *volumetricTareChar;
    NimBLEAdvertisedDevice *serverDevice = nullptr;
    bool readyForConnection = false;

    remote_err_callback_t remoteErrorCallback = nullptr;
    brew_callback_t brewBtnCallback = nullptr;
    steam_callback_t steamBtnCallback = nullptr;
    pid_control_callback_t autotuneResultCallback = nullptr;
    sensor_read_callback_t sensorCallback = nullptr;
    float_callback_t volumetricMeasurementCallback = nullptr;

    String _lastOutputControl = "";

    // BLEAdvertisedDeviceCallbacks override
    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;

    // NimBLEClientCallbacks override
    void onDisconnect(NimBLEClient *pServer) override;

    // Notification callback
    void notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify) const;

    const char *LOG_TAG = "NimBLEClientController";
};

#endif // NIMBLECLIENTCONTROLLER_H
