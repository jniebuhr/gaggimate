#include "GaggiMateClient.h"

GaggiMateClient::GaggiMateClient() : _endpoint(_transport) {}

void GaggiMateClient::init(const String &deviceName) {
    registerHandlers();
    _endpoint.onConnection([this](bool connected) {
        if (_connCb)
            _connCb(connected);
    });
    _endpoint.begin();
    _transport.init(deviceName);
}

void GaggiMateClient::loop() {
    _transport.maintain();
    _endpoint.loop();
}

void GaggiMateClient::sendPing() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_ping_tag;
    _endpoint.send(p);
}

void GaggiMateClient::sendBoilerControl(uint8_t index, float setpoint) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_boiler_tag;
    p.content.boiler.index = index;
    p.content.boiler.setpoint = setpoint;
    _endpoint.send(p);
}

void GaggiMateClient::sendPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pump_tag;
    p.content.pump.index = index;
    p.content.pump.mode = static_cast<gm::PumpMode>(mode);
    p.content.pump.power = power;
    p.content.pump.pressure = pressure;
    p.content.pump.flow = flow;
    _endpoint.send(p);
}

void GaggiMateClient::sendValveControl(uint8_t index, bool open) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_valve_tag;
    p.content.valve.index = index;
    p.content.valve.open = open;
    _endpoint.send(p);
}

void GaggiMateClient::sendAltControl(bool open) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_alt_tag;
    p.content.alt.open = open;
    _endpoint.send(p);
}

void GaggiMateClient::sendPidSettings(float kp, float ki, float kd, float kf) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pid_tag;
    p.content.pid.kp = kp;
    p.content.pid.ki = ki;
    p.content.pid.kd = kd;
    p.content.pid.kf = kf;
    _endpoint.send(p);
}

void GaggiMateClient::sendPumpModelCoeffs(float a, float b, float c, float d) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pump_model_tag;
    p.content.pump_model.a = a;
    p.content.pump_model.b = b;
    p.content.pump_model.c = c;
    p.content.pump_model.d = d;
    _endpoint.send(p);
}

void GaggiMateClient::sendAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_autotune_tag;
    p.content.autotune.test_time = testTime;
    p.content.autotune.samples = samples;
    p.content.autotune.heater_wattage = heaterWattage;
    _endpoint.send(p);
}

void GaggiMateClient::sendPressureScale(float scale) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pressure_scale_tag;
    p.content.pressure_scale.scale = scale;
    _endpoint.send(p);
}

void GaggiMateClient::sendTare() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_tare_tag;
    _endpoint.send(p);
}

void GaggiMateClient::sendLedControl(uint8_t channel, uint8_t brightness) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_led_tag;
    p.content.led.channel = channel;
    p.content.led.brightness = brightness;
    _endpoint.send(p);
}

void GaggiMateClient::sendControlBatch(const BoilerCommand &boiler, const PumpCommand &pump, const ValveCommand &valve,
                                       bool altOpen) {
    gm::Payload batch[4] = {gaggimate_Payload_init_zero, gaggimate_Payload_init_zero, gaggimate_Payload_init_zero,
                            gaggimate_Payload_init_zero};

    batch[0].which_content = gaggimate_Payload_boiler_tag;
    batch[0].content.boiler.index = boiler.index;
    batch[0].content.boiler.setpoint = boiler.setpoint;

    batch[1].which_content = gaggimate_Payload_pump_tag;
    batch[1].content.pump.index = pump.index;
    batch[1].content.pump.mode = static_cast<gm::PumpMode>(pump.mode);
    batch[1].content.pump.power = pump.power;
    batch[1].content.pump.pressure = pump.pressure;
    batch[1].content.pump.flow = pump.flow;

    batch[2].which_content = gaggimate_Payload_valve_tag;
    batch[2].content.valve.index = valve.index;
    batch[2].content.valve.open = valve.open;

    batch[3].which_content = gaggimate_Payload_alt_tag;
    batch[3].content.alt.open = altOpen;

    _endpoint.sendBatch(batch, 4);
}

void GaggiMateClient::registerHandlers() {
    _endpoint.on(gaggimate_Payload_system_info_tag, [this](const gm::Payload &p) {
        if (_systemInfoCb)
            _systemInfoCb(p.content.system_info.hardware, p.content.system_info.version,
                          p.content.system_info.capabilities.dimming, p.content.system_info.capabilities.pressure,
                          p.content.system_info.capabilities.led_control, p.content.system_info.capabilities.tof);
    });
    _endpoint.on(gaggimate_Payload_sensor_tag, [this](const gm::Payload &p) {
        if (_sensorCb)
            _sensorCb(p.content.sensor.temperature, p.content.sensor.pressure, p.content.sensor.puck_flow,
                      p.content.sensor.pump_flow, p.content.sensor.puck_resistance);
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
