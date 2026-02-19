#ifndef GAGGIMATE_PROTOCOL_H
#define GAGGIMATE_PROTOCOL_H

#include <Arduino.h>
#include <functional>
#include <pb_encode.h>
#include <pb_decode.h>

#include "protocol/gaggimate.pb.h"
#include "protocol/header.h"

namespace std {
    class any;
}

template <typename T> struct ProtocolMessage {
    MessageType type;
    uint16_t seq;
    uint8_t priority;
    T content;
    pb_msgdesc_t* descriptor;
};

// Transport-agnostic protocol callback type
typedef std::function<void(const ProtocolMessage<std::any> &)> protocol_message_callback_t;

/**
 * Pure protocol layer for GaggiMate communication using nanopb.
 * This class handles message encoding/decoding and is transport-agnostic.
 * It doesn't know about BLE, WiFi, or any other transport mechanism.
 */
class NanopbProtocol {
public:
    NanopbProtocol();
    
    // Message encoding (for sending)
    static bool encodePing(uint8_t* buffer, size_t buffer_size, size_t* message_length);
    static bool encodeOutputControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                   uint32_t mode, bool valve, float pump_setpoint, float boiler_setpoint,
                                   bool pressure_target = false, float pressure = 0, float flow = 0);
    static bool encodeAdvancedOutputControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                           bool valve, bool pressure_target, bool pump_setpoint_enable,
                                           float pump_setpoint, bool boiler_setpoint_enable,
                                           float boiler_setpoint, float pressure);
    static bool encodePidSettings(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                 float kp, float ki, float kd);
    static bool encodePumpModelCoeffs(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                     float a, float b, float c, float d);
    static bool encodeAutotune(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                              uint32_t test_time, uint32_t samples);
    static bool encodePressureScale(uint8_t* buffer, size_t buffer_size, size_t* message_length, float scale);
    static bool encodeTare(uint8_t* buffer, size_t buffer_size, size_t* message_length);
    static bool encodeLedControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                uint32_t channel, uint32_t brightness);
    static bool encodeAltControl(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool pin_state);
    
    // Server response encoding
    static bool encodeError(uint8_t* buffer, size_t buffer_size, size_t* message_length, uint32_t error_code);
    static bool encodeSensorData(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                float temp, float pressure, float puck_flow, float pump_flow, float resistance);
    static bool encodeBrewButton(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool state);
    static bool encodeSteamButton(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool state);
    static bool encodeAutotuneResult(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                    float kp, float ki, float kd);
    static bool encodeVolumetricMeasurement(uint8_t* buffer, size_t buffer_size, size_t* message_length, float volume);
    static bool encodeTofMeasurement(uint8_t* buffer, size_t buffer_size, size_t* message_length, uint32_t distance);
    static bool encodeSystemInfo(uint8_t* buffer, size_t buffer_size, size_t* message_length, const String& info);
    
    // Message decoding (for receiving)
    template <typename T> static bool decodeMessage(const uint8_t* buffer, size_t length, ProtocolMessage<T>* message);
    
    // Utility functions
    static MessageType getMessageType(const uint8_t* buffer, size_t length);
    static uint32_t getMessageId(const uint8_t* buffer, size_t length);
    static uint32_t generateMessageId();
    static String messageTypeToString(MessageType type);
    
    // Constants
    static constexpr size_t MAX_MESSAGE_SIZE = 128;
    
private:
    static uint32_t message_counter;

    // Helper to create base message
    template <typename T> static ProtocolMessage<T> wrap(MessageType type, T message, const pb_msgdesc_t *descriptor);
    template <typename T> static bool encodeMessage(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                  const ProtocolMessage<T>* message);
};



#endif // GAGGIMATE_PROTOCOL_H
