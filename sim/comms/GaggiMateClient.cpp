#include "GaggiMateClient.h"

GaggiMateClient::GaggiMateClient() {
    // Forward the mock's telemetry to whatever the firmware registered.
    _mock.onSensor = [this](float t, float p, float pf, float mf, float pr) {
        if (_sensorCb)
            _sensorCb(t, p, pf, mf, pr);
    };
    _mock.onVolumetric = [this](float v) {
        if (_volumetricCb)
            _volumetricCb(v);
    };
    _mock.onTof = [this](uint32_t d) {
        if (_tofCb)
            _tofCb(d);
    };
}

void GaggiMateClient::init(const String &) { _initialized = true; }

bool GaggiMateClient::connectToServer() {
    if (_connected)
        return true;
    _connected = true;
    _pendingConnect = true; // emit connection + system info from loop()
    return true;
}

void GaggiMateClient::loop() {
    if (_pendingConnect) {
        _pendingConnect = false;
        if (_connCb)
            _connCb(true);
        if (_systemInfoCb)
            _systemInfoCb("GaggiMate Sim", "sim-3.0", gm_proto::PROTOCOL_VERSION, true, true, true, true, {});
        _mock.begin();
    }
    if (_autotunePending && (int32_t)(millis() - _autotuneDueMs) >= 0) {
        _autotunePending = false;
        if (_autotuneResultCb)
            _autotuneResultCb(58.397f, 1.027f, 249.055f, 0.0f); // plausible Gaggia PID
    }
    if (_connected)
        _mock.update();
}

gm::Payload GaggiMateClient::buildPing() { return {gm::Payload::Ping}; }
gm::Payload GaggiMateClient::buildBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint) {
    gm::Payload p{gm::Payload::Boiler};
    p.boiler = {index, mode, setpoint};
    return p;
}
gm::Payload GaggiMateClient::buildPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow) {
    gm::Payload p{gm::Payload::Pump};
    p.pump = {index, mode, power, pressure, flow};
    return p;
}
gm::Payload GaggiMateClient::buildRelayControl(uint8_t index, bool open) {
    gm::Payload p{gm::Payload::Relay};
    p.relay = {index, open};
    return p;
}
gm::Payload GaggiMateClient::buildPidSettings(float, float, float, float) { return {gm::Payload::Pid}; }
gm::Payload GaggiMateClient::buildPumpSettings(float, float, float, float, float, float, float, float) {
    return {gm::Payload::PumpSettings};
}
gm::Payload GaggiMateClient::buildAutotune(uint32_t, uint32_t, uint32_t) { return {gm::Payload::Autotune}; }
gm::Payload GaggiMateClient::buildPressureScale(float) { return {gm::Payload::PressureScale}; }
gm::Payload GaggiMateClient::buildTare() { return {gm::Payload::Tare}; }
gm::Payload GaggiMateClient::buildLedControl(const LedChannelCommand *, size_t) { return {gm::Payload::Led}; }

void GaggiMateClient::send(const gm::Payload &payload) {
    switch (payload.type) {
    case gm::Payload::Boiler:
        _mock.setBoiler(payload.boiler);
        break;
    case gm::Payload::Pump:
        _mock.setPump(payload.pump);
        break;
    case gm::Payload::Relay:
        _mock.setRelay(payload.relay);
        break;
    case gm::Payload::Tare:
        _mock.tareScale();
        break;
    default:
        break; // ping/pid/settings/led have no effect on the model
    }
}

void GaggiMateClient::sendBatch(const gm::Payload *payloads, size_t count) {
    for (size_t i = 0; i < count; i++)
        send(payloads[i]);
}

void GaggiMateClient::sendPing() {}
void GaggiMateClient::sendBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint) {
    send(buildBoilerControl(index, mode, setpoint));
}
void GaggiMateClient::sendPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow) {
    send(buildPumpControl(index, mode, power, pressure, flow));
}
void GaggiMateClient::sendRelayControl(uint8_t index, bool open) { send(buildRelayControl(index, open)); }
void GaggiMateClient::sendPidSettings(float, float, float, float) {}
void GaggiMateClient::sendPumpSettings(float, float, float, float, float, float, float, float) {}
void GaggiMateClient::sendAutotune(uint32_t, uint32_t, uint32_t) {
    _autotunePending = true;
    _autotuneDueMs = millis() + 1500;
}
void GaggiMateClient::sendPressureScale(float) {}
void GaggiMateClient::tare() { _mock.tareScale(); }
void GaggiMateClient::sendLedControl(const LedChannelCommand *, size_t) {}
