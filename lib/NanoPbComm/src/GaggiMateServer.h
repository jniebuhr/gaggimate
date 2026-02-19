#ifndef GAGGIMATE_SERVER_H
#define GAGGIMATE_SERVER_H

#include "BLEServer.h"
#include "NanopbProtocol.h"

/**
 * High-level GaggiMate server that combines BLE transport with GaggiMate protocol.
 * This class provides the final API for base controllers to communicate with display controllers.
 */
class GaggiMateServer {
public:
    GaggiMateServer();
    ~GaggiMateServer();
    
    // Server management
    void init(const String& deviceName);
    void initialize(const String& deviceName); // Alias for backward compatibility
    bool isConnected() const;
    void startAdvertising();
    void stopAdvertising();
    
    // Raw message sending (for backward compatibility)
    bool sendRawMessage(const uint8_t* data, size_t length);
    
    // Protocol-level message sending (server responses)
    bool sendError(uint32_t error_code);
    bool sendSensorData(float temp, float pressure, float puck_flow, float pump_flow, float resistance);
    bool sendBrewButton(bool state);
    bool sendSteamButton(bool state);
    bool sendAutotuneResult(float kp, float ki, float kd);
    bool sendVolumetricMeasurement(float volume);
    bool sendTofMeasurement(uint32_t distance);
    bool sendSystemInfo(const String& info);
    
    // Register callback for protocol messages from client
    void registerMessageCallback(const protocol_message_callback_t& callback);
    
    // Device info
    void setDeviceInfo(const String& info);
    String getDeviceInfo() const;
    
    // Check if system info needs to be sent
    void checkSystemInfoSend();

private:
    BLETransportServer bleServer;
    NanopbProtocol protocol;
    protocol_message_callback_t message_callback;
    
    // System info sending
    bool needsSystemInfoSend = false;
    unsigned long connectionTime = 0;
    
    // Handle raw data received from BLE transport
    void handleBLEData(const uint8_t* data, size_t length);
    
    // Helper to send protocol messages
    template<typename... Args>
    bool sendProtocolMessage(bool (*encoder)(uint8_t*, size_t, size_t*, Args...), Args... args);
};

#endif // GAGGIMATE_SERVER_H