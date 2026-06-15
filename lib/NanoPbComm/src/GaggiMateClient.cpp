#include "GaggiMateClient.h"

GaggiMateClient::GaggiMateClient() : _endpoint(_transport) {}

void GaggiMateClient::init(const String &deviceName) {
    registerHandlers();
    _endpoint.onConnection([this](bool connected) {
        if (_connCb)
            _connCb(connected);
    });
    _transport.onIncompatible([this](const String &info) {
        if (_incompatibleCb)
            _incompatibleCb(info);
    });
    _endpoint.begin();
    _transport.init(deviceName);
}

void GaggiMateClient::loop() {
    _transport.maintain();
    _endpoint.loop();
}

gm::Payload GaggiMateClient::buildPing() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_ping_tag;
    return p;
}

gm::Payload GaggiMateClient::buildBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_boiler_tag;
    p.content.boiler.index = index;
    p.content.boiler.mode = static_cast<gm::BoilerMode>(mode);
    p.content.boiler.setpoint = setpoint;
    return p;
}

gm::Payload GaggiMateClient::buildPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pump_tag;
    p.content.pump.index = index;
    p.content.pump.mode = static_cast<gm::PumpMode>(mode);
    p.content.pump.power = power;
    p.content.pump.pressure = pressure;
    p.content.pump.flow = flow;
    return p;
}

gm::Payload GaggiMateClient::buildRelayControl(uint8_t index, bool open) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_relay_tag;
    p.content.relay.index = index;
    p.content.relay.open = open;
    return p;
}

gm::Payload GaggiMateClient::buildPidSettings(float kp, float ki, float kd, float kf) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pid_tag;
    p.content.pid.kp = kp;
    p.content.pid.ki = ki;
    p.content.pid.kd = kd;
    p.content.pid.kf = kf;
    return p;
}

gm::Payload GaggiMateClient::buildPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain,
                                               float integralGain, float maxPower) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pump_model_tag;
    p.content.pump_model.a = a;
    p.content.pump_model.b = b;
    p.content.pump_model.c = c;
    p.content.pump_model.d = d;
    p.content.pump_model.commutationGain = commutationGain;
    p.content.pump_model.convergenceGain = convergenceGain;
    p.content.pump_model.integralGain = integralGain;
    p.content.pump_model.maxBLDCPower = maxPower;
    return p;
}

gm::Payload GaggiMateClient::buildAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_autotune_tag;
    p.content.autotune.test_time = testTime;
    p.content.autotune.samples = samples;
    p.content.autotune.heater_wattage = heaterWattage;
    return p;
}

gm::Payload GaggiMateClient::buildPressureScale(float scale) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pressure_scale_tag;
    p.content.pressure_scale.scale = scale;
    return p;
}

gm::Payload GaggiMateClient::buildTare() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_tare_tag;
    return p;
}

gm::Payload GaggiMateClient::buildLedControl(const LedChannelCommand *channels, size_t count) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_led_tag;
    const size_t maxCount = sizeof(p.content.led.channels) / sizeof(p.content.led.channels[0]);
    if (channels == nullptr)
        count = 0;
    if (count > maxCount)
        count = maxCount;
    p.content.led.channels_count = static_cast<pb_size_t>(count);
    for (size_t i = 0; i < count; i++) {
        p.content.led.channels[i].channel = channels[i].channel;
        p.content.led.channels[i].brightness = channels[i].brightness;
    }
    return p;
}

void GaggiMateClient::sendPing() { _endpoint.send(buildPing()); }

void GaggiMateClient::sendBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint) {
    _endpoint.send(buildBoilerControl(index, mode, setpoint));
}

void GaggiMateClient::sendPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow) {
    _endpoint.send(buildPumpControl(index, mode, power, pressure, flow));
}

void GaggiMateClient::sendRelayControl(uint8_t index, bool open) { _endpoint.send(buildRelayControl(index, open)); }

void GaggiMateClient::sendPidSettings(float kp, float ki, float kd, float kf) {
    _endpoint.send(buildPidSettings(kp, ki, kd, kf));
}

void GaggiMateClient::sendPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain,
                                       float integralGain, float maxPower) {
    _endpoint.send(buildPumpSettings(a, b, c, d, commutationGain, convergenceGain, integralGain, maxPower));
}

void GaggiMateClient::sendAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage) {
    _endpoint.send(buildAutotune(testTime, samples, heaterWattage));
}

void GaggiMateClient::sendPressureScale(float scale) { _endpoint.send(buildPressureScale(scale)); }

void GaggiMateClient::tare() { _endpoint.send(buildTare()); }

void GaggiMateClient::sendLedControl(const LedChannelCommand *channels, size_t count) {
    _endpoint.send(buildLedControl(channels, count));
}

void GaggiMateClient::registerHandlers() {
    _endpoint.on(gaggimate_Payload_system_info_tag, [this](const gm::Payload &p) {
        if (_systemInfoCb) {
            std::vector<uint32_t> addonList = {};
            if (p.content.system_info.capabilities.addons_count > 0) {
                for (int i = 0; i < p.content.system_info.capabilities.addons_count; i++) {
                    addonList.push_back(p.content.system_info.capabilities.addons[i].type);
                }
            }
            _systemInfoCb(p.content.system_info.hardware, p.content.system_info.version, p.content.system_info.protocol_version,
                          p.content.system_info.capabilities.dimming, p.content.system_info.capabilities.pressure,
                          p.content.system_info.capabilities.led_control, p.content.system_info.capabilities.tof, addonList);
        }
    });
    _endpoint.on(gaggimate_Payload_sensor_tag, [this](const gm::Payload &p) {
        if (!_sensorCb)
            return;
        // The display tracks a single boiler today; read boiler 0 if present.
        float temperature = 0.0f;
        float pressure = 0.0f;
        if (p.content.sensor.boilers_count > 0) {
            temperature = p.content.sensor.boilers[0].temperature;
            pressure = p.content.sensor.boilers[0].pressure;
        }
        _sensorCb(temperature, pressure, p.content.sensor.puck_flow, p.content.sensor.pump_flow,
                  p.content.sensor.puck_resistance);
    });
    _endpoint.on(gaggimate_Payload_button_tag, [this](const gm::Payload &p) {
        if (_buttonCb)
            _buttonCb(static_cast<uint8_t>(p.content.button.index), p.content.button.pressed);
    });
    _endpoint.on(gaggimate_Payload_autotune_result_tag, [this](const gm::Payload &p) {
        if (_autotuneResultCb)
            _autotuneResultCb(p.content.autotune_result.kp, p.content.autotune_result.ki, p.content.autotune_result.kd,
                              p.content.autotune_result.kf);
    });
    _endpoint.on(gaggimate_Payload_volumetric_tag, [this](const gm::Payload &p) {
        if (_volumetricCb)
            _volumetricCb(p.content.volumetric.volume);
    });
    _endpoint.on(gaggimate_Payload_tof_tag, [this](const gm::Payload &p) {
        if (_tofCb)
            _tofCb(p.content.tof.distance);
    });
    _endpoint.on(gaggimate_Payload_error_tag, [this](const gm::Payload &p) {
        if (_errorCb)
            _errorCb(static_cast<int>(p.content.error.code));
    });
}
