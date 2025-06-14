#ifndef MOCKBLECLIENTCONTROLLER_H
#define MOCKBLECLIENTCONTROLLER_H

#include "NimBLEComm.h"
#include <string>

class MockBLEClientController {
public:
    MockBLEClientController();
    ~MockBLEClientController();
    
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
    void registerRemoteErrorCallback(const remote_err_callback_t &callback);
    void registerBrewBtnCallback(const brew_callback_t &callback);
    void registerSteamBtnCallback(const steam_callback_t &callback);
    void registerSensorCallback(const sensor_read_callback_t &callback);
    void registerAutotuneResultCallback(const pid_control_callback_t &callback);
    std::string readInfo() const;
    void* getClient() const;

    // Mock triggers
    void triggerRemoteError(int errorCode);
    void triggerBrewBtn(bool brewButtonStatus);
    void triggerSteamBtn(bool steamButtonStatus);
    void triggerSensor(float temperature, float pressure);
    void triggerAutotuneResult(float Kp, float Ki, float Kd);

private:
    remote_err_callback_t remoteErrorCallback = nullptr;
    brew_callback_t brewBtnCallback = nullptr;
    steam_callback_t steamBtnCallback = nullptr;
    pid_control_callback_t autotuneResultCallback = nullptr;
    sensor_read_callback_t sensorCallback = nullptr;
};

#endif // MOCKBLECLIENTCONTROLLER_H
