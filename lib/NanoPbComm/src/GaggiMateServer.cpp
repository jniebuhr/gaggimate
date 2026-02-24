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
    return sendEncoded([error_code](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeError(buffer, buffer_size, message_length, error_code);
    });
}

bool GaggiMateServer::sendSensorData(float temp, float pressure, float puck_flow, float pump_flow, float resistance) {
    return sendEncoded([temp, pressure, puck_flow, pump_flow, resistance](uint8_t* buffer, size_t buffer_size,
                                                                           size_t* message_length) {
        return NanopbProtocol::encodeSensorData(buffer, buffer_size, message_length, temp, pressure, puck_flow, pump_flow,
                                                resistance);
    });
}

bool GaggiMateServer::sendBrewButton(bool state) {
    return sendEncoded([state](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeBrewButton(buffer, buffer_size, message_length, state);
    });
}

bool GaggiMateServer::sendSteamButton(bool state) {
    return sendEncoded([state](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeSteamButton(buffer, buffer_size, message_length, state);
    });
}

bool GaggiMateServer::sendAutotuneResult(float kp, float ki, float kd) {
    return sendEncoded([kp, ki, kd](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeAutotuneResult(buffer, buffer_size, message_length, kp, ki, kd);
    });
}

bool GaggiMateServer::sendVolumetricMeasurement(float volume) {
    return sendEncoded([volume](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeVolumetricMeasurement(buffer, buffer_size, message_length, volume);
    });
}

bool GaggiMateServer::sendTofMeasurement(uint32_t distance) {
    return sendEncoded([distance](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeTofMeasurement(buffer, buffer_size, message_length, distance);
    });
}

bool GaggiMateServer::sendSystemInfo(const String& info) {
    ESP_LOGI("GaggiMateServer", "About to encode system info message, input length: %d", info.length());
    ESP_LOGI("GaggiMateServer", "Input string: %s", info.c_str());

    return sendEncoded([&info](uint8_t* buffer, size_t buffer_size, size_t* message_length) {
        return NanopbProtocol::encodeSystemInfo(buffer, buffer_size, message_length, info);
    });
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
        ProtocolMessage<std::any> message;
        if (NanopbProtocol::decodeMessage(data, length, &message)) {
            message_callback(message);
        }
    }
}
