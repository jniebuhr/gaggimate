#include "NanopbProtocol.h"

uint32_t NanopbProtocol::message_counter = 0;

NanopbProtocol::NanopbProtocol() {
    // Constructor
}

template<typename T>
ProtocolMessage<T> NanopbProtocol::wrap(MessageType type, T message, const pb_msgdesc_t *descriptor) {
    ProtocolMessage<T> wrapped_message;
    wrapped_message.type = type;
    wrapped_message.seq = generateMessageId();
    wrapped_message.priority = 0;
    wrapped_message.content = message;
    wrapped_message.descriptor = descriptor;
    return wrapped_message;
}

template<typename T>
bool NanopbProtocol::encodeMessage(uint8_t *buffer, size_t buffer_size, size_t *message_length, const ProtocolMessage<T> *message) {
    if (buffer == nullptr || message_length == nullptr || message == nullptr) {
        return false;
    }

    constexpr size_t footer_size = 2;
    if (buffer_size <= sizeof(FrameHeader) + footer_size) {
        return false;
    }

    uint8_t* p = buffer;
    FrameHeader hdr {
        .seq = message->seq,
        .mt = message->type,
    };
    pb_ostream_t os = pb_ostream_from_buffer(buffer + sizeof(FrameHeader), buffer_size - sizeof(FrameHeader) - footer_size);
    if (!pb_encode(&os, message->descriptor, &message->content)) return false;
    size_t pb_len = os.bytes_written;

    if (pb_len > UINT16_MAX) {
        return false;
    }

    hdr.len = static_cast<uint16_t>(pb_len);
    memcpy(p, &hdr, sizeof(hdr));
    buffer[sizeof(FrameHeader) + pb_len] = 0;
    buffer[sizeof(FrameHeader) + pb_len + 1] = 0;
    *message_length = sizeof(FrameHeader) + pb_len + footer_size;
    return true;
}

uint32_t NanopbProtocol::generateMessageId() {
    return ++message_counter;
}

String NanopbProtocol::messageTypeToString(MessageType type) {
    switch (type) {
        case MessageType_MSG_PING: return "PING";
        case MessageType_MSG_OUTPUT_CONTROL: return "OUTPUT_CONTROL";
        case MessageType_MSG_PID_SETTINGS: return "PID_SETTINGS";
        case MessageType_MSG_AUTOTUNE: return "AUTOTUNE";
        case MessageType_MSG_PRESSURE_SCALE: return "PRESSURE_SCALE";
        case MessageType_MSG_TARE: return "TARE";
        case MessageType_MSG_LED_CONTROL: return "LED_CONTROL";
        case MessageType_MSG_ALT_CONTROL: return "ALT_CONTROL";
        case MessageType_MSG_ERROR: return "ERROR";
        case MessageType_MSG_SENSOR_DATA: return "SENSOR_DATA";
        case MessageType_MSG_BREW_BUTTON: return "BREW_BUTTON";
        case MessageType_MSG_STEAM_BUTTON: return "STEAM_BUTTON";
        case MessageType_MSG_AUTOTUNE_RESULT: return "AUTOTUNE_RESULT";
        case MessageType_MSG_VOLUMETRIC: return "VOLUMETRIC";
        case MessageType_MSG_TOF: return "TOF";
        case MessageType_MSG_SYSTEM_INFO: return "SYSTEM_INFO";
        default: return "UNKNOWN";
    }
}

bool NanopbProtocol::encodePing(uint8_t* buffer, size_t buffer_size, size_t* message_length) {
    PingRequest message = PingRequest_init_default;
    ProtocolMessage<PingRequest> wrapper = wrap(MessageType_MSG_PING, message, &PingRequest_msg);
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeOutputControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                           uint32_t mode, bool valve, float pump_setpoint, float boiler_setpoint,
                                           bool pressure_target, float pressure, float flow) {
    OutputControlRequest message = OutputControlRequest_init_default;
    message.mode = mode;
    message.valve_open = valve;
    message.pump_setpoint = pump_setpoint;
    message.boiler_setpoint = boiler_setpoint;
    message.pressure_target = pressure_target;
    message.pressure = pressure;
    message.flow = flow;
    ProtocolMessage<OutputControlRequest> wrapper = wrap(MessageType_MSG_OUTPUT_CONTROL, message, &OutputControlRequest_msg);
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeAdvancedOutputControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                                   bool valve, bool pressure_target, bool pump_setpoint_enable,
                                                   float pump_setpoint, bool boiler_setpoint_enable,
                                                   float boiler_setpoint, float pressure) {
    return encodeOutputControl(buffer, buffer_size, message_length,
                              1, // mode = advanced
                              valve, pump_setpoint, boiler_setpoint,
                              pressure_target, pressure, 0.0f);
}

bool NanopbProtocol::encodePidSettings(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                         float kp, float ki, float kd) {
    PidSettingsRequest message = PidSettingsRequest_init_default;
    message.kp = kp;
    message.ki = ki;
    message.kd = kd;
    ProtocolMessage<PidSettingsRequest> wrapper = wrap(MessageType_MSG_PID_SETTINGS, message, &PidSettingsRequest_msg);
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodePumpModelCoeffs(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                             float a, float b, float c, float d) {
    PumpModelCoeffsRequest message = PumpModelCoeffsRequest_init_default;
    message.a = a;
    message.b = b;
    message.c = c;
    message.d = d;
    ProtocolMessage<PumpModelCoeffsRequest> wrapper = wrap(MessageType_MSG_PUMP_MODEL, message, &PumpModelCoeffsRequest_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeAutotune(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                      uint32_t test_time, uint32_t samples) {
    AutotuneRequest message = AutotuneRequest_init_default;
    message.test_time = test_time;
    message.samples = samples;
    ProtocolMessage<AutotuneRequest> wrapper = wrap(MessageType_MSG_AUTOTUNE, message, &AutotuneRequest_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodePressureScale(uint8_t* buffer, size_t buffer_size, size_t* message_length, float scale) {
    PressureScaleRequest message = PressureScaleRequest_init_default;
    message.scale = scale;
    ProtocolMessage<PressureScaleRequest> wrapper = wrap(MessageType_MSG_PRESSURE_SCALE, message, &PressureScaleRequest_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeTare(uint8_t* buffer, size_t buffer_size, size_t* message_length) {
    TareRequest message = TareRequest_init_default;
    ProtocolMessage<TareRequest> wrapper = wrap(MessageType_MSG_TARE, message, &TareRequest_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeLedControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                        uint32_t channel, uint32_t brightness) {
    LedControlRequest message = LedControlRequest_init_default;
    message.channel = channel;
    message.brightness = brightness;
    ProtocolMessage<LedControlRequest> wrapper = wrap(MessageType_MSG_LED_CONTROL, message, &LedControlRequest_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeAltControl(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool pin_state) {
    AltControlRequest message = AltControlRequest_init_default;
    message.pin_state = pin_state;
    ProtocolMessage<AltControlRequest> wrapper = wrap(MessageType_MSG_ALT_CONTROL, message, &AltControlRequest_msg);

    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeError(uint8_t* buffer, size_t buffer_size, size_t* message_length, uint32_t error_code) {
    ErrorResponse message = ErrorResponse_init_default;
    message.error_code = error_code;
    ProtocolMessage<ErrorResponse> wrapper = wrap(MessageType_MSG_ERROR, message, &ErrorResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeSensorData(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                        float temp, float pressure, float puck_flow, float pump_flow, float resistance) {
    SensorDataResponse message = SensorDataResponse_init_default;
    message.temperature = temp;
    message.pressure = pressure;
    message.puck_flow = puck_flow;
    message.pump_flow = pump_flow;
    message.puck_resistance = resistance;
    ProtocolMessage<SensorDataResponse> wrapper = wrap(MessageType_MSG_SENSOR_DATA, message, &SensorDataResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeBrewButton(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool state) {
    BrewButtonResponse message = BrewButtonResponse_init_default;
    message.button_state = state;
    ProtocolMessage<BrewButtonResponse> wrapper = wrap(MessageType_MSG_BREW_BUTTON, message, &BrewButtonResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeSteamButton(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool state) {
    SteamButtonResponse message = SteamButtonResponse_init_default;
    message.button_state = state;
    ProtocolMessage<SteamButtonResponse> wrapper = wrap(MessageType_MSG_STEAM_BUTTON, message, &SteamButtonResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeAutotuneResult(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                            float kp, float ki, float kd) {
    AutotuneResultResponse message = AutotuneResultResponse_init_default;
    message.kp = kp;
    message.ki = ki;
    message.kd = kd;
    ProtocolMessage<AutotuneResultResponse> wrapper = wrap(MessageType_MSG_AUTOTUNE_RESULT, message, &AutotuneResultResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeVolumetricMeasurement(uint8_t* buffer, size_t buffer_size, size_t* message_length, float volume) {
    VolumetricMeasurementResponse message = VolumetricMeasurementResponse_init_default;
    message.volume = volume;
    ProtocolMessage<VolumetricMeasurementResponse> wrapper = wrap(MessageType_MSG_VOLUMETRIC, message, &VolumetricMeasurementResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeTofMeasurement(uint8_t* buffer, size_t buffer_size, size_t* message_length, uint32_t distance) {
    TofMeasurementResponse message = TofMeasurementResponse_init_default;
    message.distance = distance;
    ProtocolMessage<TofMeasurementResponse> wrapper = wrap(MessageType_MSG_TOF, message, &TofMeasurementResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

bool NanopbProtocol::encodeSystemInfo(uint8_t* buffer, size_t buffer_size, size_t* message_length, const String& info) {
    SystemInfoResponse message = SystemInfoResponse_init_default;
    strncpy(message.info, info.c_str(), sizeof(message.info) - 1);
    message.info[sizeof(message.info) - 1] = '\0';
    ProtocolMessage<SystemInfoResponse> wrapper = wrap(MessageType_MSG_SYSTEM_INFO, message, &SystemInfoResponse_msg);
    
    return encodeMessage(buffer, buffer_size, message_length, &wrapper);
}

MessageType NanopbProtocol::getMessageType(const uint8_t* buffer, size_t length) {
    if (buffer == nullptr || length < sizeof(FrameHeader)) {
        return MessageType_MSG_UNKNOWN;
    }

    const FrameHeader* header = reinterpret_cast<const FrameHeader*>(buffer);
    return static_cast<MessageType>(header->mt);
}

uint32_t NanopbProtocol::getMessageId(const uint8_t* buffer, size_t length) {
    if (buffer == nullptr || length < sizeof(FrameHeader)) {
        return 0;
    }

    const FrameHeader* header = reinterpret_cast<const FrameHeader*>(buffer);
    return header->seq;
}

bool NanopbProtocol::decodeMessage(const uint8_t* data, size_t length, ProtocolMessage<std::any>* message) {
    if (data == nullptr || message == nullptr || length < sizeof(FrameHeader)) {
        return false;
    }

    const FrameHeader* header = reinterpret_cast<const FrameHeader*>(data);
    const size_t payload_len = header->len;
    if (length < sizeof(FrameHeader) + payload_len) {
        return false;
    }

    const uint8_t* payload = data + sizeof(FrameHeader);
    pb_istream_t stream = pb_istream_from_buffer(payload, payload_len);

    message->type = static_cast<MessageType>(header->mt);
    message->seq = header->seq;
    message->priority = 0;

    switch (message->type) {
        case MessageType_MSG_PING: {
            PingRequest decoded = PingRequest_init_default;
            if (!pb_decode(&stream, &PingRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&PingRequest_msg);
            return true;
        }
        case MessageType_MSG_OUTPUT_CONTROL: {
            OutputControlRequest decoded = OutputControlRequest_init_default;
            if (!pb_decode(&stream, &OutputControlRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&OutputControlRequest_msg);
            return true;
        }
        case MessageType_MSG_PID_SETTINGS: {
            PidSettingsRequest decoded = PidSettingsRequest_init_default;
            if (!pb_decode(&stream, &PidSettingsRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&PidSettingsRequest_msg);
            return true;
        }
        case MessageType_MSG_PUMP_MODEL: {
            PumpModelCoeffsRequest decoded = PumpModelCoeffsRequest_init_default;
            if (!pb_decode(&stream, &PumpModelCoeffsRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&PumpModelCoeffsRequest_msg);
            return true;
        }
        case MessageType_MSG_AUTOTUNE: {
            AutotuneRequest decoded = AutotuneRequest_init_default;
            if (!pb_decode(&stream, &AutotuneRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&AutotuneRequest_msg);
            return true;
        }
        case MessageType_MSG_PRESSURE_SCALE: {
            PressureScaleRequest decoded = PressureScaleRequest_init_default;
            if (!pb_decode(&stream, &PressureScaleRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&PressureScaleRequest_msg);
            return true;
        }
        case MessageType_MSG_TARE: {
            TareRequest decoded = TareRequest_init_default;
            if (!pb_decode(&stream, &TareRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&TareRequest_msg);
            return true;
        }
        case MessageType_MSG_LED_CONTROL: {
            LedControlRequest decoded = LedControlRequest_init_default;
            if (!pb_decode(&stream, &LedControlRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&LedControlRequest_msg);
            return true;
        }
        case MessageType_MSG_ALT_CONTROL: {
            AltControlRequest decoded = AltControlRequest_init_default;
            if (!pb_decode(&stream, &AltControlRequest_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&AltControlRequest_msg);
            return true;
        }
        case MessageType_MSG_ERROR: {
            ErrorResponse decoded = ErrorResponse_init_default;
            if (!pb_decode(&stream, &ErrorResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&ErrorResponse_msg);
            return true;
        }
        case MessageType_MSG_SENSOR_DATA: {
            SensorDataResponse decoded = SensorDataResponse_init_default;
            if (!pb_decode(&stream, &SensorDataResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&SensorDataResponse_msg);
            return true;
        }
        case MessageType_MSG_BREW_BUTTON: {
            BrewButtonResponse decoded = BrewButtonResponse_init_default;
            if (!pb_decode(&stream, &BrewButtonResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&BrewButtonResponse_msg);
            return true;
        }
        case MessageType_MSG_STEAM_BUTTON: {
            SteamButtonResponse decoded = SteamButtonResponse_init_default;
            if (!pb_decode(&stream, &SteamButtonResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&SteamButtonResponse_msg);
            return true;
        }
        case MessageType_MSG_AUTOTUNE_RESULT: {
            AutotuneResultResponse decoded = AutotuneResultResponse_init_default;
            if (!pb_decode(&stream, &AutotuneResultResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&AutotuneResultResponse_msg);
            return true;
        }
        case MessageType_MSG_VOLUMETRIC: {
            VolumetricMeasurementResponse decoded = VolumetricMeasurementResponse_init_default;
            if (!pb_decode(&stream, &VolumetricMeasurementResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&VolumetricMeasurementResponse_msg);
            return true;
        }
        case MessageType_MSG_TOF: {
            TofMeasurementResponse decoded = TofMeasurementResponse_init_default;
            if (!pb_decode(&stream, &TofMeasurementResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&TofMeasurementResponse_msg);
            return true;
        }
        case MessageType_MSG_SYSTEM_INFO: {
            SystemInfoResponse decoded = SystemInfoResponse_init_default;
            if (!pb_decode(&stream, &SystemInfoResponse_msg, &decoded)) return false;
            message->content = decoded;
            message->descriptor = const_cast<pb_msgdesc_t*>(&SystemInfoResponse_msg);
            return true;
        }
        case MessageType_MSG_UNKNOWN:
        default:
            return false;
    }
}
