#ifndef NIMBLESERVERCONTROLLER_H
#define NIMBLESERVERCONTROLLER_H

#include "NimBLEComm.h"
#include "cstring"
#include <ble_ota_dfu.hpp>

class NimBLEServerController : public NimBLEServerCallbacks, public NimBLECharacteristicCallbacks {
  public:
    NimBLEServerController();
    void initServer(String infoString);
    void sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow);
    void sendError(int errorCode);
    void sendBrewBtnState(bool brewButtonStatus);
    void sendSteamBtnState(bool steamButtonStatus);
    void sendAutotuneResult(float Kp, float Ki, float Kd);
    void sendVolumetricMeasurement(float value);
    void sendTofMeasurement(int value);
    void registerOutputControlCallback(const simple_output_callback_t &callback);
    void registerAdvancedOutputControlCallback(const advanced_output_callback_t &callback);
    void registerAltControlCallback(const pin_control_callback_t &callback);
    void registerPidControlCallback(const pid_control_callback_t &callback);
    void registerPingCallback(const ping_callback_t &callback);
    void registerAutotuneCallback(const autotune_callback_t &callback);
    void registerPressureScaleCallback(const float_callback_t &callback);
    void registerTareCallback(const void_callback_t &callback);
    void registerLedControlCallback(const led_control_callback_t &callback);
    void setInfo(String infoString);

  private:
    bool deviceConnected = false;
    String infoString = "";
    NimBLECharacteristic *outputControlChar = nullptr;
    NimBLECharacteristic *pressureScaleChar = nullptr;
    NimBLECharacteristic *altControlChar = nullptr;
    NimBLECharacteristic *pingChar = nullptr;
    NimBLECharacteristic *pidControlChar = nullptr;
    NimBLECharacteristic *errorChar = nullptr;
    NimBLECharacteristic *autotuneChar = nullptr;
    NimBLECharacteristic *autotuneResultChar = nullptr;
    NimBLECharacteristic *brewBtnChar = nullptr;
    NimBLECharacteristic *steamBtnChar = nullptr;
    NimBLECharacteristic *infoChar = nullptr;
    NimBLECharacteristic *sensorChar = nullptr;
    NimBLECharacteristic *volumetricMeasurementChar = nullptr;
    NimBLECharacteristic *volumetricTareChar = nullptr;
    NimBLECharacteristic *tofMeasurementChar = nullptr;
    NimBLECharacteristic *ledControlChar = nullptr;

    simple_output_callback_t outputControlCallback = nullptr;
    advanced_output_callback_t advancedControlCallback = nullptr;
    pin_control_callback_t altControlCallback = nullptr;
    pid_control_callback_t pidControlCallback = nullptr;
    ping_callback_t pingCallback = nullptr;
    autotune_callback_t autotuneCallback = nullptr;
    float_callback_t pressureScaleCallback = nullptr;
    void_callback_t tareCallback = nullptr;
    led_control_callback_t ledControlCallback = nullptr;

    // BLEServerCallbacks overrides
    void onConnect(NimBLEServer *pServer) override;
    void onDisconnect(NimBLEServer *pServer) override;

    // BLECharacteristicCallbacks overrides
    void onWrite(NimBLECharacteristic *pCharacteristic) override;

    BLE_OTA_DFU ota_dfu_ble;

    const char *LOG_TAG = "NimBLEClientController";
};

#endif // NIMBLESERVERCONTROLLER_H
