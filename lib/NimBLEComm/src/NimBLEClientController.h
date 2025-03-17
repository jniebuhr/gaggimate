#ifndef NIMBLECLIENTCONTROLLER_H
#define NIMBLECLIENTCONTROLLER_H

#include "NimBLEComm.h"

class NimBLEClientController : public NimBLEAdvertisedDeviceCallbacks, NimBLEClientCallbacks {
  public:
    NimBLEClientController();
    void initClient();
    bool connectToServer();
    void sendTemperatureControl(float setpoint);
    void sendPumpControl(float setpoint);
    void sendValveControl(bool pinState);
    void sendAltControl(bool pinState);
    void sendPing();
    void sendAutotune();
    void sendPidSettings(const String &pid);
    bool isReadyForConnection() const;
    bool isConnected();
    void scan();
    void registerTempReadCallback(const temp_read_callback_t &callback);
    void registerRemoteErrorCallback(const remote_err_callback_t &callback);
    void registerBrewBtnCallback(const brew_callback_t &callback);
    void registerSteamBtnCallback(const steam_callback_t &callback);
    void registerPressureCallback(const pressure_read_callback_t &callback);
    const char *readInfo() const;
    NimBLEClient *getClient() const { return client; };

  private:
    NimBLEClient *client;

    NimBLERemoteCharacteristic *tempControlChar;
    NimBLERemoteCharacteristic *pumpControlChar;
    NimBLERemoteCharacteristic *valveControlChar;
    NimBLERemoteCharacteristic *altControlChar;
    NimBLERemoteCharacteristic *tempReadChar;
    NimBLERemoteCharacteristic *pingChar;
    NimBLERemoteCharacteristic *pidControlChar;
    NimBLERemoteCharacteristic *errorChar;
    NimBLERemoteCharacteristic *autotuneChar;
    NimBLERemoteCharacteristic *brewBtnChar;
    NimBLERemoteCharacteristic *steamBtnChar;
    NimBLERemoteCharacteristic *infoChar;
    NimBLERemoteCharacteristic *pressureChar;
    NimBLEAdvertisedDevice *serverDevice;
    bool readyForConnection = false;

    temp_read_callback_t tempReadCallback = nullptr;
    remote_err_callback_t remoteErrorCallback = nullptr;
    brew_callback_t brewBtnCallback = nullptr;
    steam_callback_t steamBtnCallback = nullptr;
    pressure_read_callback_t pressureCallback = nullptr;

    // BLEAdvertisedDeviceCallbacks override
    void onResult(NimBLEAdvertisedDevice *advertisedDevice) override;

    // NimBLEClientCallbacks override
    void onDisconnect(NimBLEClient *pServer) override;

    // Notification callback
    void notifyCallback(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify) const;

    const char *LOG_TAG = "NimBLEClientController";
};

#endif // NIMBLECLIENTCONTROLLER_H
