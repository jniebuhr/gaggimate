#include "GaggiMateClient.h"

#include <cmath>
#include <cstdio>

GaggiMateClient::GaggiMateClient() {
    Serial.println("[GaggiMateClient] GaggiMateClient constructor called");
    // Constructor
}

GaggiMateClient::~GaggiMateClient() {
    // Destructor
}

void GaggiMateClient::init() {
    bleClient.initClient();
    bleClient.registerDataCallback([this](const uint8_t* data, size_t length) {
        handleBLEData(data, length);
    });
}

void GaggiMateClient::initialize() {
    init(); // Alias for backward compatibility
}

bool GaggiMateClient::connect() {
    return bleClient.connectToServer();
}

bool GaggiMateClient::isConnected() const {
    return bleClient.isConnected();
}

bool GaggiMateClient::isReadyForConnection() const {
    return bleClient.isReadyForConnection();
}

void GaggiMateClient::scan() {
    bleClient.scan();
}

void GaggiMateClient::disconnect() {
    bleClient.disconnect();
}

bool GaggiMateClient::sendRawMessage(const uint8_t* data, size_t length) {
    return bleClient.sendData(data, length);
}

String GaggiMateClient::readSystemInfo() const {
    return bleClient.readDeviceInfo();
}

bool GaggiMateClient::sendPing() {
    return sendEncoded([](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodePing(buffer, buffer_size, message_length);
    });
}

bool GaggiMateClient::sendOutputControl(bool heater_enabled, bool solenoid_enabled, bool pump_enabled,
                                       float heater_setpoint, float pump_setpoint) {
    const uint32_t mode = 0; // Basic mode
    const float applied_pump_setpoint = pump_enabled ? pump_setpoint : 0.0f;
    const float applied_heater_setpoint = heater_enabled ? heater_setpoint : 0.0f;
    return sendEncoded([mode, solenoid_enabled, applied_pump_setpoint, applied_heater_setpoint](
                           uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeOutputControl(buffer, buffer_size, message_length, mode, solenoid_enabled,
                                                   applied_pump_setpoint, applied_heater_setpoint, false, 0.0f, 0.0f);
    });
}

bool GaggiMateClient::sendAdvancedOutputControl(bool heater_enabled, bool solenoid_enabled, bool pump_enabled,
                                               float heater_setpoint, bool pressure_target,
                                               float pressure_setpoint, float flow_setpoint) {
    const uint32_t mode = 1; // Advanced mode
    const float applied_heater_setpoint = heater_enabled ? heater_setpoint : 0.0f;
    const float applied_pressure_setpoint = pump_enabled ? pressure_setpoint : 0.0f;
    const float applied_flow_setpoint = pump_enabled ? flow_setpoint : 0.0f;
    return sendEncoded([mode, solenoid_enabled, applied_heater_setpoint, pressure_target, applied_pressure_setpoint,
                        applied_flow_setpoint](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeOutputControl(buffer, buffer_size, message_length, mode, solenoid_enabled, 0.0f,
                                                   applied_heater_setpoint, pressure_target, applied_pressure_setpoint,
                                                   applied_flow_setpoint);
    });
}

bool GaggiMateClient::sendAutotune(uint32_t test_time, uint32_t samples) {
    return sendEncoded([test_time, samples](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeAutotune(buffer, buffer_size, message_length, test_time, samples);
    });
}

bool GaggiMateClient::sendPidSettings(float kp, float ki, float kd) {
    return sendEncoded([kp, ki, kd](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodePidSettings(buffer, buffer_size, message_length, kp, ki, kd);
    });
}

bool GaggiMateClient::sendPumpModelCoeffs(float a, float b, float c, float d) {
    return sendEncoded([a, b, c, d](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodePumpModelCoeffs(buffer, buffer_size, message_length, a, b, c, d);
    });
}

bool GaggiMateClient::sendPressureScale(float scale) {
    return sendEncoded([scale](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodePressureScale(buffer, buffer_size, message_length, scale);
    });
}

bool GaggiMateClient::sendLedControl(uint8_t channel, uint8_t brightness) {
    return sendEncoded([channel, brightness](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeLedControl(buffer, buffer_size, message_length, static_cast<uint32_t>(channel),
                                                static_cast<uint32_t>(brightness));
    });
}

bool GaggiMateClient::sendTare() {
    return sendEncoded([](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeTare(buffer, buffer_size, message_length);
    });
}


bool GaggiMateClient::sendOutputControl(bool valve, float pump_setpoint, float boiler_setpoint) {
    return sendOutputControl(true, valve, true, boiler_setpoint, pump_setpoint);
}

bool GaggiMateClient::sendAdvancedOutputControl(bool valve, float boiler_setpoint, bool pressure_target,
                                                float pressure_setpoint, float flow_setpoint) {
    return sendAdvancedOutputControl(true, valve, true, boiler_setpoint, pressure_target, pressure_setpoint, flow_setpoint);
}

bool GaggiMateClient::sendPidSettings(const String& pid) {
    float kp = 0.0f;
    float ki = 0.0f;
    float kd = 0.0f;
    float kf = 0.0f;
    const int parsed = sscanf(pid.c_str(), "%f,%f,%f,%f", &kp, &ki, &kd, &kf);
    if (parsed < 3) {
        return false;
    }
    return sendPidSettings(kp, ki, kd);
}

bool GaggiMateClient::sendPumpModelCoeffs(const String& coeffs) {
    float a = 0.0f;
    float b = 0.0f;
    float c = NAN;
    float d = NAN;
    const int parsed = sscanf(coeffs.c_str(), "%f,%f,%f,%f", &a, &b, &c, &d);
    if (parsed < 2) {
        return false;
    }
    return sendPumpModelCoeffs(a, b, c, d);
}

bool GaggiMateClient::sendAltControl(bool pin_state) {
    return sendEncoded([pin_state](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeAltControl(buffer, buffer_size, message_length, pin_state);
    });
}

void GaggiMateClient::registerMessageCallback(const protocol_message_callback_t& callback) {
    message_callback = callback;
}


void GaggiMateClient::handleBLEData(const uint8_t* data, size_t length) {
    if (message_callback) {
        ProtocolMessage<std::any> message;
        if (NanopbProtocol::decodeMessage(data, length, &message)) {
            message_callback(message);
        }
    }
}

NimBLEClient* GaggiMateClient::getNativeClient() const {
    return bleClient.getNativeClient();
}
