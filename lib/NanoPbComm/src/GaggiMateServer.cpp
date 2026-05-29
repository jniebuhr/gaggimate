#include "GaggiMateServer.h"
#include <cstring>

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

    xTaskCreatePinnedToCore(pumpTask, "GaggiMateServer", 4096, this, 1, &_taskHandle, 0);
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
    _systemInfo.has_capabilities = true;
    _systemInfo.capabilities.dimming = dimming;
    _systemInfo.capabilities.pressure = pressure;
    _systemInfo.capabilities.led_control = ledControl;
    _systemInfo.capabilities.tof = tof;
}

void GaggiMateServer::pushSystemInfo() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_system_info_tag;
    p.content.system_info = _systemInfo;
    _endpoint.send(p);
}

void GaggiMateServer::sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_sensor_tag;
    p.content.sensor.temperature = temperature;
    p.content.sensor.pressure = pressure;
    p.content.sensor.puck_flow = puckFlow;
    p.content.sensor.pump_flow = pumpFlow;
    p.content.sensor.puck_resistance = puckResistance;
    _endpoint.send(p);
}

void GaggiMateServer::sendButtonState(uint8_t index, bool pressed) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_button_tag;
    p.content.button.index = index;
    p.content.button.pressed = pressed;
    _endpoint.send(p);
}

void GaggiMateServer::sendAutotuneResult(float kp, float ki, float kd, float kf) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_autotune_result_tag;
    p.content.autotune_result.kp = kp;
    p.content.autotune_result.ki = ki;
    p.content.autotune_result.kd = kd;
    p.content.autotune_result.kf = kf;
    _endpoint.send(p);
}

void GaggiMateServer::sendVolumetricMeasurement(float volume) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_volumetric_tag;
    p.content.volumetric.volume = volume;
    _endpoint.send(p);
}

void GaggiMateServer::sendTofMeasurement(uint32_t distance) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_tof_tag;
    p.content.tof.distance = distance;
    _endpoint.send(p);
}

void GaggiMateServer::sendError(int code) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_error_tag;
    p.content.error.code = static_cast<gm::ErrorCode>(code);
    _endpoint.send(p);
}

void GaggiMateServer::registerHandlers() {
    _endpoint.on(gaggimate_Payload_ping_tag, [this](const gm::Payload &) {
        if (_pingCb)
            _pingCb();
    });
    _endpoint.on(gaggimate_Payload_boiler_tag, [this](const gm::Payload &p) {
        if (_boilerCb)
            _boilerCb(static_cast<uint8_t>(p.content.boiler.index), p.content.boiler.setpoint);
    });
    _endpoint.on(gaggimate_Payload_pump_tag, [this](const gm::Payload &p) {
        if (_pumpCb)
            _pumpCb(static_cast<uint8_t>(p.content.pump.index), static_cast<PumpControlMode>(p.content.pump.mode),
                    p.content.pump.power, p.content.pump.pressure, p.content.pump.flow);
    });
    _endpoint.on(gaggimate_Payload_valve_tag, [this](const gm::Payload &p) {
        if (_valveCb)
            _valveCb(static_cast<uint8_t>(p.content.valve.index), p.content.valve.open);
    });
    _endpoint.on(gaggimate_Payload_alt_tag, [this](const gm::Payload &p) {
        if (_altCb)
            _altCb(p.content.alt.open);
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
        if (_ledCb)
            _ledCb(static_cast<uint8_t>(p.content.led.channel), static_cast<uint8_t>(p.content.led.brightness));
    });
}
