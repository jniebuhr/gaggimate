#include "GaggiMateClient.h"

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

bool GaggiMateClient::sendPing() {
    return sendProtocolMessage(NanopbProtocol::encodePing);
}

bool GaggiMateClient::sendOutputControl(bool heater_enabled, bool solenoid_enabled, bool pump_enabled, 
                                       float heater_setpoint, float pump_setpoint) {
    uint32_t mode = 0; // Basic mode
    return sendProtocolMessage(NanopbProtocol::encodeOutputControl, 
                              mode, solenoid_enabled, pump_setpoint, heater_setpoint, false, 0.0f, 0.0f);
}

bool GaggiMateClient::sendAdvancedOutputControl(bool heater_enabled, bool solenoid_enabled, bool pump_enabled,
                                               float heater_setpoint, bool pressure_target, 
                                               float pressure_setpoint, float flow_setpoint) {
    uint32_t mode = 1; // Advanced mode
    return sendProtocolMessage(NanopbProtocol::encodeOutputControl, 
                              mode, solenoid_enabled, 0.0f, heater_setpoint,
                              pressure_target, pressure_setpoint, flow_setpoint);
}

bool GaggiMateClient::sendAutotune(uint32_t test_time, uint32_t samples) {
    return sendProtocolMessage(NanopbProtocol::encodeAutotune, test_time, samples);
}

bool GaggiMateClient::sendPidSettings(float kp, float ki, float kd) {
    return sendProtocolMessage(NanopbProtocol::encodePidSettings, kp, ki, kd);
}

bool GaggiMateClient::sendPumpModelCoeffs(float a, float b, float c, float d) {
    return sendProtocolMessage(NanopbProtocol::encodePumpModelCoeffs, a, b, c, d);
}

bool GaggiMateClient::sendPressureScale(float scale) {
    return sendProtocolMessage(NanopbProtocol::encodePressureScale, scale);
}

bool GaggiMateClient::sendLedControl(uint8_t channel, uint8_t brightness) {
    return sendProtocolMessage(NanopbProtocol::encodeLedControl, 
                              static_cast<uint32_t>(channel), static_cast<uint32_t>(brightness));
}

bool GaggiMateClient::sendTare() {
    return sendProtocolMessage(NanopbProtocol::encodeTare);
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

template<typename... Args>
bool GaggiMateClient::sendProtocolMessage(bool (*encoder)(uint8_t*, size_t, size_t*, Args...), Args... args) {
    uint8_t buffer[NanopbProtocol::MAX_MESSAGE_SIZE];
    size_t message_length;
    
    if (encoder(buffer, sizeof(buffer), &message_length, args...)) {
        return bleClient.sendData(buffer, message_length);
    }
    
    return false;
}

NimBLEClient* GaggiMateClient::getNativeClient() const {
    return bleClient.getNativeClient();
}
