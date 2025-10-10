#include "NanopbProtocol.h"

uint32_t NanopbProtocol::message_counter = 0;

NanopbProtocol::NanopbProtocol() {
    // Constructor
}

GaggiMessage NanopbProtocol::createBaseMessage(MessageType type) {
    GaggiMessage message = GaggiMessage_init_zero;
    message.type = type;
    message.msg_id = generateMessageId();
    return message;
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
    GaggiMessage message = GaggiMessage_init_default;
    message.type = MessageType_MSG_PING;
    message.which_payload = GaggiMessage_ping_tag;
    // PingRequest has only a dummy_field, no timestamp needed
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, GaggiMessage_fields, &message);
    *message_length = stream.bytes_written;
    return status;
}

bool NanopbProtocol::encodeOutputControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                           uint32_t mode, bool valve, float pump_setpoint, float boiler_setpoint,
                                           bool pressure_target, float pressure, float flow) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_OUTPUT_CONTROL);
    message.which_payload = GaggiMessage_output_control_tag;
    message.payload.output_control.mode = mode;
    message.payload.output_control.valve_open = valve;
    message.payload.output_control.pump_setpoint = pump_setpoint;
    message.payload.output_control.boiler_setpoint = boiler_setpoint;
    message.payload.output_control.pressure_target = pressure_target;
    message.payload.output_control.pressure = pressure;
    message.payload.output_control.flow = flow;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
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
    GaggiMessage message = createBaseMessage(MessageType_MSG_PID_SETTINGS);
    message.which_payload = GaggiMessage_pid_settings_tag;
    message.payload.pid_settings.kp = kp;
    message.payload.pid_settings.ki = ki;
    message.payload.pid_settings.kd = kd;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodePumpModelCoeffs(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                             float a, float b, float c, float d) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_OUTPUT_CONTROL);
    message.which_payload = GaggiMessage_output_control_tag;
    // Note: Pump model coeffs might need their own message type in the future
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeAutotune(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                      uint32_t test_time, uint32_t samples) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_AUTOTUNE);
    message.which_payload = GaggiMessage_autotune_tag;
    message.payload.autotune.test_time = test_time;
    message.payload.autotune.samples = samples;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodePressureScale(uint8_t* buffer, size_t buffer_size, size_t* message_length, float scale) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_PRESSURE_SCALE);
    message.which_payload = GaggiMessage_pressure_scale_tag;
    message.payload.pressure_scale.scale = scale;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeTare(uint8_t* buffer, size_t buffer_size, size_t* message_length) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_TARE);
    message.which_payload = GaggiMessage_tare_tag;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeLedControl(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                        uint32_t channel, uint32_t brightness) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_LED_CONTROL);
    message.which_payload = GaggiMessage_led_control_tag;
    message.payload.led_control.channel = channel;
    message.payload.led_control.brightness = brightness;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeError(uint8_t* buffer, size_t buffer_size, size_t* message_length, uint32_t error_code) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_ERROR);
    message.which_payload = GaggiMessage_error_tag;
    message.payload.error.error_code = error_code;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeSensorData(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                        float temp, float pressure, float puck_flow, float pump_flow, float resistance) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_SENSOR_DATA);
    message.which_payload = GaggiMessage_sensor_data_tag;
    message.payload.sensor_data.temperature = temp;
    message.payload.sensor_data.pressure = pressure;
    message.payload.sensor_data.puck_flow = puck_flow;
    message.payload.sensor_data.pump_flow = pump_flow;
    message.payload.sensor_data.puck_resistance = resistance;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeBrewButton(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool state) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_BREW_BUTTON);
    message.which_payload = GaggiMessage_brew_button_tag;
    message.payload.brew_button.button_state = state;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeSteamButton(uint8_t* buffer, size_t buffer_size, size_t* message_length, bool state) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_STEAM_BUTTON);
    message.which_payload = GaggiMessage_steam_button_tag;
    message.payload.steam_button.button_state = state;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeAutotuneResult(uint8_t* buffer, size_t buffer_size, size_t* message_length,
                                            float kp, float ki, float kd) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_AUTOTUNE_RESULT);
    message.which_payload = GaggiMessage_autotune_result_tag;
    message.payload.autotune_result.kp = kp;
    message.payload.autotune_result.ki = ki;
    message.payload.autotune_result.kd = kd;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeVolumetricMeasurement(uint8_t* buffer, size_t buffer_size, size_t* message_length, float volume) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_VOLUMETRIC);
    message.which_payload = GaggiMessage_volumetric_tag;
    message.payload.volumetric.volume = volume;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeTofMeasurement(uint8_t* buffer, size_t buffer_size, size_t* message_length, uint32_t distance) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_TOF);
    message.which_payload = GaggiMessage_tof_tag;
    message.payload.tof.distance = distance;
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::encodeSystemInfo(uint8_t* buffer, size_t buffer_size, size_t* message_length, const String& info) {
    GaggiMessage message = createBaseMessage(MessageType_MSG_SYSTEM_INFO);
    message.which_payload = GaggiMessage_system_info_tag;
    strncpy(message.payload.system_info.info, info.c_str(), sizeof(message.payload.system_info.info) - 1);
    message.payload.system_info.info[sizeof(message.payload.system_info.info) - 1] = '\0';
    
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, &GaggiMessage_msg, &message);
    
    if (status) {
        *message_length = stream.bytes_written;
    }
    
    return status;
}

bool NanopbProtocol::decodeMessage(const uint8_t* data, size_t length, GaggiMessage* message) {
    pb_istream_t stream = pb_istream_from_buffer(data, length);
    return pb_decode(&stream, &GaggiMessage_msg, message);
}