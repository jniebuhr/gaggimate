#ifndef GAGGIMATE_CLIENT_H
#define GAGGIMATE_CLIENT_H

#include "BLEClient.h"
#include "NanopbProtocol.h"

/**
 * High-level GaggiMate client that combines BLE transport with GaggiMate protocol.
 * This class provides the final API for display controllers to communicate with base controllers.
 */
class GaggiMateClient {
public:
    GaggiMateClient();
    ~GaggiMateClient();
    
    // Connection management
    void init();
    void initialize(); // Alias for backward compatibility
    bool connect();
    bool isConnected() const;
    bool isReadyForConnection() const;
    void scan();
    void disconnect();
    
    // Raw message sending (for backward compatibility)
    bool sendRawMessage(const uint8_t* data, size_t length);
    String readSystemInfo() const;
    
    // Protocol-level message sending
    bool sendPing();
    bool sendOutputControl(bool heater_enabled, bool solenoid_enabled, bool pump_enabled, 
                          float heater_setpoint, float pump_setpoint);
    bool sendAdvancedOutputControl(bool heater_enabled, bool solenoid_enabled, bool pump_enabled,
                                  float heater_setpoint, bool pressure_target, 
                                  float pressure_setpoint, float flow_setpoint);
    bool sendAutotune(uint32_t test_time, uint32_t samples);
    bool sendPidSettings(float kp, float ki, float kd);
    bool sendPumpModelCoeffs(float a, float b, float c, float d);
    bool sendPressureScale(float scale);
    bool sendLedControl(uint8_t channel, uint8_t brightness);
    bool sendTare();

    // Compatibility API for existing display code
    bool sendOutputControl(bool valve, float pump_setpoint, float boiler_setpoint);
    bool sendAdvancedOutputControl(bool valve, float boiler_setpoint, bool pressure_target,
                                   float pressure_setpoint, float flow_setpoint);
    bool sendPidSettings(const String& pid);
    bool sendPumpModelCoeffs(const String& coeffs);
    bool setPressureScale(float scale) { return sendPressureScale(scale); }
    bool sendAltControl(bool pin_state);
    bool tare() { return sendTare(); }
    
    // Register callback for protocol messages from server
    void registerMessageCallback(const protocol_message_callback_t& callback);
    
    // Access to underlying transport (for compatibility)
    NimBLEClient* getNativeClient() const;

private:
    BLETransportClient bleClient;
    NanopbProtocol protocol;
    protocol_message_callback_t message_callback;
    
    // Handle raw data received from BLE transport
    void handleBLEData(const uint8_t* data, size_t length);

    template <typename Encoder>
    bool sendEncoded(Encoder&& encoder) {
        uint8_t buffer[NanopbProtocol::MAX_MESSAGE_SIZE];
        size_t message_length = 0;
        if (!encoder(buffer, sizeof(buffer), &message_length)) {
            return false;
        }
        return bleClient.sendData(buffer, message_length);
    }

};

#endif // GAGGIMATE_CLIENT_H
