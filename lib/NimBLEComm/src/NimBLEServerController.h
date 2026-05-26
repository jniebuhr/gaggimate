#ifndef NIMBLESERVERCONTROLLER_H
#define NIMBLESERVERCONTROLLER_H

#include "NimBLEComm.h"
#include "cstring"
#include <ble_ota_dfu.hpp>

class NimBLEServerController : public NimBLEServerCallbacks, public NimBLECharacteristicCallbacks {
  public:
    NimBLEServerController();
    void initServer(String infoString);
    void loop();

    void sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance);
    void sendError(int errorCode);

    void sendAutotuneResult(float Kp, float Ki, float Kd, float Kf);
    void sendBtnState(uint8_t index, bool status);
    void sendVolumetricMeasurement(float value);
    void sendTofMeasurement(int value);
    void registerOutputControlCallback(const simple_output_callback_t &callback);
    void registerAdvancedOutputControlCallback(const advanced_output_callback_t &callback);
    void registerAltControlCallback(const pin_control_callback_t &callback);
    void registerPidControlCallback(const pid_control_callback_t &callback);
    void registerPumpModelCoeffsCallback(const pump_model_coeffs_callback_t &callback);
    void registerPingCallback(const ping_callback_t &callback);
    void registerAutotuneCallback(const autotune_callback_t &callback);
    void registerPressureScaleCallback(const float_callback_t &callback);
    void registerTareCallback(const void_callback_t &callback);
    void registerLedControlCallback(const led_control_callback_t &callback);
    void setInfo(String infoString);

    // Pairing mode control
    void enterPairingMode();
    void exitPairingMode();
    void clearAllBonds();

    // PIN confirmation for DISPLAY_YESNO pairing
    void confirmPairingPin();
    void rejectPairingPin();
    bool isPinConfirmationPending() const;

  private:
    // Pairing state management
    enum class PairingState {
        NORMAL,           // Only accepts bonded devices
        PAIRING_INITIATED,// User pressed button, waiting for connection
        PAIRING_ACTIVE,   // Client connected, pairing in progress
    };

    PairingState pairingState = PairingState::NORMAL;
    unsigned long pairingModeStartTime = 0;
    const unsigned long PAIRING_TIMEOUT_MS = 60000; // 60 seconds

    // PIN confirmation state for DISPLAY_YESNO pairing
    enum class PinConfirmState {
        IDLE,              // No confirmation pending
        AWAITING_CONFIRM,  // Waiting for button press
        CONFIRMED,         // User confirmed
        REJECTED,          // User rejected or timeout
    };

    PinConfirmState pinConfirmState = PinConfirmState::IDLE;
    uint32_t currentPairingPin = 0;
    unsigned long pinConfirmStartTime = 0;
    const unsigned long PIN_CONFIRM_TIMEOUT_MS = 30000; // 30 seconds

    bool isPairingModeActive() const;
    bool isConnectionSecure() const;
    void checkPinConfirmationTimeout();
    bool deviceConnected = false;
    String infoString = "";
    NimBLEAdvertising *advertising = nullptr;
    NimBLEServer *server = nullptr;

    NimBLECharacteristic *outputControlChar = nullptr;
    NimBLECharacteristic *pressureScaleChar = nullptr;
    NimBLECharacteristic *altControlChar = nullptr;
    NimBLECharacteristic *pingChar = nullptr;
    NimBLECharacteristic *pidControlChar = nullptr;
    NimBLECharacteristic *pumpModelCoeffsChar = nullptr;
    NimBLECharacteristic *errorChar = nullptr;
    NimBLECharacteristic *autotuneChar = nullptr;
    NimBLECharacteristic *autotuneResultChar = nullptr;
    NimBLECharacteristic *btnChar = nullptr;
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
    pump_model_coeffs_callback_t pumpModelCoeffsCallback = nullptr;
    ping_callback_t pingCallback = nullptr;
    autotune_callback_t autotuneCallback = nullptr;
    float_callback_t pressureScaleCallback = nullptr;
    void_callback_t tareCallback = nullptr;
    led_control_callback_t ledControlCallback = nullptr;
    char sensorDataBuffer[80]{};
    char errorBuffer[12]{};
    char btnBuffer[10]{};
    char autotuneResultBuffer[64]{};
    char tofBuffer[16]{};
    char volumetricBuffer[16]{};

    // BLEServerCallbacks overrides
    void onConnect(NimBLEServer *pServer) override;
    void onDisconnect(NimBLEServer *pServer) override;
    bool onConfirmPIN(uint32_t pass_key) override;

    // BLECharacteristicCallbacks overrides
    void onWrite(NimBLECharacteristic *pCharacteristic) override;

    BLE_OTA_DFU ota_dfu_ble;

    const char *LOG_TAG = "NimBLEClientController";
    xTaskHandle taskHandle;
    static void loopTask(void *arg);
};

#endif // NIMBLESERVERCONTROLLER_H
