#include "GaggiMateServer.h"

GaggiMateServer::GaggiMateServer() {
    // Constructor
}

GaggiMateServer::~GaggiMateServer() {
    // Destructor
}

void GaggiMateServer::init(const String& deviceName) {
    bleServer.initServer(deviceName);
    bleServer.registerDataCallback([this](const uint8_t* data, size_t length) {
        handleBLEData(data, length);
    });
    bleServer.registerConnectionCallback([this](bool connected) {
        ESP_LOGI("GaggiMateServer", "Connection callback triggered, connected: %s", connected ? "true" : "false");
        if (connected) {
            ESP_LOGI("GaggiMateServer", "Client connected");
            connectionTime = millis();
            needsSystemInfoSend = true;
        } else {
            ESP_LOGI("GaggiMateServer", "Client disconnected");
            needsSystemInfoSend = false;
        }
    });
}

void GaggiMateServer::initialize(const String& deviceName) {
    init(deviceName); // Alias for backward compatibility
}

bool GaggiMateServer::isConnected() const {
    return bleServer.isConnected();
}

void GaggiMateServer::startAdvertising() {
    bleServer.startAdvertising();
}

void GaggiMateServer::stopAdvertising() {
    bleServer.stopAdvertising();
}

bool GaggiMateServer::sendRawMessage(const uint8_t* data, size_t length) {
    return bleServer.sendData(data, length);
}

bool GaggiMateServer::sendError(uint32_t error_code) {
    return sendProtocolMessage(NanopbProtocol::encodeError, error_code);
}

bool GaggiMateServer::sendSensorData(float temp, float pressure, float puck_flow, float pump_flow, float resistance) {
    return sendProtocolMessage(NanopbProtocol::encodeSensorData, temp, pressure, puck_flow, pump_flow, resistance);
}

bool GaggiMateServer::sendBrewButton(bool state) {
    return sendProtocolMessage(NanopbProtocol::encodeBrewButton, state);
}

bool GaggiMateServer::sendSteamButton(bool state) {
    return sendProtocolMessage(NanopbProtocol::encodeSteamButton, state);
}

bool GaggiMateServer::sendAutotuneResult(float kp, float ki, float kd) {
    return sendProtocolMessage(NanopbProtocol::encodeAutotuneResult, kp, ki, kd);
}

bool GaggiMateServer::sendVolumetricMeasurement(float volume) {
    return sendProtocolMessage(NanopbProtocol::encodeVolumetricMeasurement, volume);
}

bool GaggiMateServer::sendTofMeasurement(uint32_t distance) {
    return sendProtocolMessage(NanopbProtocol::encodeTofMeasurement, distance);
}

bool GaggiMateServer::sendSystemInfo(const String& info) {
    // Explicitly avoid template deduction issue with const String&
    uint8_t buffer[NanopbProtocol::MAX_MESSAGE_SIZE];
    size_t message_length;
    
    ESP_LOGI("GaggiMateServer", "About to encode system info message, input length: %d", info.length());
    ESP_LOGI("GaggiMateServer", "Input string: %s", info.c_str());
    
    if (NanopbProtocol::encodeSystemInfo(buffer, sizeof(buffer), &message_length, info)) {
        ESP_LOGI("GaggiMateServer", "Successfully encoded system info, message length: %d bytes", message_length);
        ESP_LOGI("GaggiMateServer", "Max BLE message size: %d bytes", NanopbProtocol::MAX_MESSAGE_SIZE);
        
        bool result = bleServer.sendData(buffer, message_length);
        ESP_LOGI("GaggiMateServer", "BLE sendData result: %s", result ? "SUCCESS" : "FAILED");
        return result;
    } else {
        ESP_LOGE("GaggiMateServer", "Failed to encode system info message!");
        return false;
    }
}

void GaggiMateServer::registerMessageCallback(const protocol_message_callback_t& callback) {
    message_callback = callback;
}

void GaggiMateServer::setDeviceInfo(const String& info) {
    bleServer.setDeviceInfo(info);
}

String GaggiMateServer::getDeviceInfo() const {
    return bleServer.getDeviceInfo();
}

void GaggiMateServer::checkSystemInfoSend() {
    // Send system info 500ms after connection to ensure client is ready
    if (needsSystemInfoSend && isConnected() && (millis() - connectionTime > 500)) {
        if (!getDeviceInfo().isEmpty()) {
            ESP_LOGI("GaggiMateServer", "Sending delayed system info to client");
            sendSystemInfo(getDeviceInfo());
            needsSystemInfoSend = false;
        } else {
            ESP_LOGW("GaggiMateServer", "System info is empty, cannot send");
            needsSystemInfoSend = false;
        }
    }
}

void GaggiMateServer::handleBLEData(const uint8_t* data, size_t length) {
    if (message_callback) {
        GaggiMessage message;
        if (NanopbProtocol::decodeMessage(data, length, &message)) {
            message_callback(message);
        }
    }
}

template<typename... Args>
bool GaggiMateServer::sendProtocolMessage(bool (*encoder)(uint8_t*, size_t, size_t*, Args...), Args... args) {
    uint8_t buffer[NanopbProtocol::MAX_MESSAGE_SIZE];
    size_t message_length;
    
    if (encoder(buffer, sizeof(buffer), &message_length, args...)) {
        return bleServer.sendData(buffer, message_length);
    }
    
    return false;
}