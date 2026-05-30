#include "GaggiMateServer.h"
#include <cstdio>
#include <cstring>
#include <esp_log.h>

GaggiMateServer::GaggiMateServer() : _endpoint(_transport) {}

void GaggiMateServer::init(const String &deviceName, const String &hardware, const String &version, bool dimming, bool pressure,
                           bool ledControl, bool tof) {
    setSystemInfo(hardware, version, dimming, pressure, ledControl, tof);
    registerHandlers();
    _endpoint.onConnection([this](bool connected) {
        if (connected)
            pushSystemInfo();
    });
    _endpoint.begin();
    _transport.init(deviceName);

    if (xTaskCreatePinnedToCore(pumpTask, "GaggiMateServer", 4096, this, 1, &_taskHandle, 0) != pdPASS) {
        _taskHandle = nullptr;
        ESP_LOGE("GaggiMateServer", "Failed to create pump task; ACK/retransmit will not run");
    }
}

void GaggiMateServer::pumpTask(void *arg) {
    auto *self = static_cast<GaggiMateServer *>(arg);
    TickType_t lastWake = xTaskGetTickCount();
    for (;;) {
        self->_endpoint.loop();
        xTaskDelayUntil(&lastWake, pdMS_TO_TICKS(15));
    }
}

void GaggiMateServer::setSystemInfo(const String &hardware, const String &version, bool dimming, bool pressure, bool ledControl,
                                    bool tof) {
    memset(&_systemInfo, 0, sizeof(_systemInfo));
    strlcpy(_systemInfo.hardware, hardware.c_str(), sizeof(_systemInfo.hardware));
    strlcpy(_systemInfo.version, version.c_str(), sizeof(_systemInfo.version));
    _systemInfo.protocol_version = gm_proto::PROTOCOL_VERSION;
    _systemInfo.has_capabilities = true;
    _systemInfo.capabilities.dimming = dimming;
    _systemInfo.capabilities.pressure = pressure;
    _systemInfo.capabilities.led_control = ledControl;
    _systemInfo.capabilities.tof = tof;

    // Mirror system info onto the legacy read-only characteristic in the old
    // JSON shape (plus "pv"), so pre-framing tools can still read it.
    char json[224];
    snprintf(json, sizeof(json), "{\"hw\":\"%s\",\"v\":\"%s\",\"pv\":%u,\"cp\":{\"ps\":%s,\"dm\":%s,\"led\":%s,\"tof\":%s}}",
             hardware.c_str(), version.c_str(), static_cast<unsigned>(gm_proto::PROTOCOL_VERSION), pressure ? "true" : "false",
             dimming ? "true" : "false", ledControl ? "true" : "false", tof ? "true" : "false");
    _transport.setInfo(json);
}

void GaggiMateServer::pushSystemInfo() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_system_info_tag;
    p.content.system_info = _systemInfo;
    _endpoint.send(p);
}

gm::Payload GaggiMateServer::buildSensorData(float temperature, float pressure, float puckFlow, float pumpFlow,
                                             float puckResistance) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_sensor_tag;
    p.content.sensor.boilers_count = 1; // boiler 0; schema allows more
    p.content.sensor.boilers[0].index = 0;
    p.content.sensor.boilers[0].temperature = temperature;
    p.content.sensor.boilers[0].pressure = pressure;
    p.content.sensor.puck_flow = puckFlow;
    p.content.sensor.pump_flow = pumpFlow;
    p.content.sensor.puck_resistance = puckResistance;
    return p;
}

gm::Payload GaggiMateServer::buildButtonState(uint8_t index, bool pressed) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_button_tag;
    p.content.button.index = index;
    p.content.button.pressed = pressed;
    return p;
}

gm::Payload GaggiMateServer::buildAutotuneResult(float kp, float ki, float kd, float kf) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_autotune_result_tag;
    p.content.autotune_result.kp = kp;
    p.content.autotune_result.ki = ki;
    p.content.autotune_result.kd = kd;
    p.content.autotune_result.kf = kf;
    return p;
}

gm::Payload GaggiMateServer::buildVolumetricMeasurement(float volume) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_volumetric_tag;
    p.content.volumetric.volume = volume;
    return p;
}

gm::Payload GaggiMateServer::buildTofMeasurement(uint32_t distance) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_tof_tag;
    p.content.tof.distance = distance;
    return p;
}

gm::Payload GaggiMateServer::buildError(int code) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_error_tag;
    p.content.error.code = static_cast<gm::ErrorCode>(code);
    return p;
}

// Telemetry (sensor / volumetric / ToF) is sent fire-and-forget: it is
// high-rate and self-refreshing, so a dropped sample is replaced by the next
// one. This avoids the constant ACK chatter on the high-rate path. Button /
// autotune-result / error / system-info stay reliable.
void GaggiMateServer::sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance) {
    _endpoint.sendUnreliable(buildSensorData(temperature, pressure, puckFlow, pumpFlow, puckResistance));
}

void GaggiMateServer::sendButtonState(uint8_t index, bool pressed) { _endpoint.send(buildButtonState(index, pressed)); }

void GaggiMateServer::sendAutotuneResult(float kp, float ki, float kd, float kf) {
    _endpoint.send(buildAutotuneResult(kp, ki, kd, kf));
}

void GaggiMateServer::sendVolumetricMeasurement(float volume) { _endpoint.sendUnreliable(buildVolumetricMeasurement(volume)); }

void GaggiMateServer::sendTofMeasurement(uint32_t distance) { _endpoint.sendUnreliable(buildTofMeasurement(distance)); }

void GaggiMateServer::sendError(int code) { _endpoint.send(buildError(code)); }

void GaggiMateServer::registerHandlers() {
    _endpoint.on(gaggimate_Payload_ping_tag, [this](const gm::Payload &) {
        if (_pingCb)
            _pingCb();
    });
    _endpoint.on(gaggimate_Payload_boiler_tag, [this](const gm::Payload &p) {
        if (_boilerCb)
            _boilerCb(static_cast<uint8_t>(p.content.boiler.index), static_cast<BoilerControlMode>(p.content.boiler.mode),
                      p.content.boiler.setpoint);
    });
    _endpoint.on(gaggimate_Payload_pump_tag, [this](const gm::Payload &p) {
        if (_pumpCb)
            _pumpCb(static_cast<uint8_t>(p.content.pump.index), static_cast<PumpControlMode>(p.content.pump.mode),
                    p.content.pump.power, p.content.pump.pressure, p.content.pump.flow);
    });
    _endpoint.on(gaggimate_Payload_relay_tag, [this](const gm::Payload &p) {
        if (_relayCb)
            _relayCb(static_cast<uint8_t>(p.content.relay.index), p.content.relay.open);
    });
    _endpoint.on(gaggimate_Payload_pid_tag, [this](const gm::Payload &p) {
        if (_pidCb)
            _pidCb(p.content.pid.kp, p.content.pid.ki, p.content.pid.kd, p.content.pid.kf);
    });
    _endpoint.on(gaggimate_Payload_pump_model_tag, [this](const gm::Payload &p) {
        if (_pumpModelCb)
            _pumpModelCb(p.content.pump_model.a, p.content.pump_model.b, p.content.pump_model.c, p.content.pump_model.d);
    });
    _endpoint.on(gaggimate_Payload_autotune_tag, [this](const gm::Payload &p) {
        if (_autotuneCb)
            _autotuneCb(p.content.autotune.test_time, p.content.autotune.samples, p.content.autotune.heater_wattage);
    });
    _endpoint.on(gaggimate_Payload_pressure_scale_tag, [this](const gm::Payload &p) {
        if (_pressureScaleCb)
            _pressureScaleCb(p.content.pressure_scale.scale);
    });
    _endpoint.on(gaggimate_Payload_tare_tag, [this](const gm::Payload &) {
        if (_tareCb)
            _tareCb();
    });
    _endpoint.on(gaggimate_Payload_led_tag, [this](const gm::Payload &p) {
        if (!_ledCb)
            return;
        // One message carries every changed channel; apply them in order.
        for (pb_size_t i = 0; i < p.content.led.channels_count; i++)
            _ledCb(static_cast<uint8_t>(p.content.led.channels[i].channel),
                   static_cast<uint8_t>(p.content.led.channels[i].brightness));
    });
}
