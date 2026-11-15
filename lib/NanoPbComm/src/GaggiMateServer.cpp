#include "GaggiMateServer.h"
#include <cstdio>
#include <cstring>
#include <esp_log.h>

GaggiMateServer::GaggiMateServer() = default;

void GaggiMateServer::enableUart(uint8_t rxPin, uint8_t txPin, HardwareSerial &port, uint32_t baud) {
    if (_uart)
        return;
    _uartPort = &port;
    _uartRxPin = rxPin;
    _uartTxPin = txPin;
    _uartBaud = baud;
    _uart = std::make_unique<UartTransport>(port);
    _uartOta = std::make_unique<UartOtaReceiver>(*_uart);
}

void GaggiMateServer::init(const String &deviceName, const String &hardware, const String &version,
                           const gm::DeviceCapabilities &capabilities, bool pairingWindow) {
    setSystemInfo(hardware, version, capabilities);
    registerHandlers();
    _endpoint.onConnection([this](bool connected) {
        _sentSystemInfoAfterHandshake = false;
        if (connected)
            pushSystemInfo();
        if (_connCb)
            _connCb(connected);
    });
    _link.add(LinkType::Ble, _ble);
    if (_uart) {
        _link.add(LinkType::Uart, *_uart);
        _link.setPreferred(LinkType::Uart);
    }
    _link.onSelect([this](LinkType active) { onLinkSelected(active); });
    _link.onReject([this](LinkType) { _ble.disconnect(); }); // only BLE can lose, UART preempts
    _endpoint.begin();
    _ble.init(deviceName, pairingWindow);

    if (_uart) {
        _uartOta->onStart([this]() {
            if (_updateStartCb)
                _updateStartCb();
        });
        _uartOta->begin();
        _uartPort->setRxBufferSize(gm_uart::RX_BUFFER_SIZE);
        _uartPort->setTxBufferSize(gm_uart::TX_BUFFER_SIZE);
        _uartPort->begin(_uartBaud, SERIAL_8N1, _uartRxPin, _uartTxPin);
        _uart->begin();
        ESP_LOGI("GaggiMateServer", "Display link on UART rx=%u tx=%u @ %u baud", _uartRxPin, _uartTxPin,
                 static_cast<unsigned>(_uartBaud));
    }

    if (xTaskCreatePinnedToCore(pumpTask, "GaggiMateServer", 4096, this, 1, &_taskHandle, 0) != pdPASS) {
        _taskHandle = nullptr;
        ESP_LOGE("GaggiMateServer", "Failed to create pump task; comms will not run");
        return;
    }
    if (_uart) {
        TaskHandle_t task = _taskHandle;
        _uartPort->onReceive([task]() { xTaskNotifyGive(task); });
    }
}

// The wire keeps listening while BLE carries the session; once it is up, the radio link goes away and stops advertising.
void GaggiMateServer::onLinkSelected(LinkType active) {
    _ble.setAdvertisingEnabled(active != LinkType::Uart);
    if (active == LinkType::Uart)
        _ble.disconnect();
}

void GaggiMateServer::disconnect() {
    if (_link.activeType() == LinkType::Uart)
        _uart->disconnect();
    else
        _ble.disconnect();
}

void GaggiMateServer::pumpTask(void *arg) {
    auto *self = static_cast<GaggiMateServer *>(arg);
    for (;;) {
        if (self->_uart)
            self->_uart->loop();
        self->_endpoint.loop();
        // Woken early by UART RX; the timeout paces keepalives and the retransmit check.
        ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(15));
    }
}

void GaggiMateServer::setSystemInfo(const String &hardware, const String &version, const gm::DeviceCapabilities &capabilities) {
    memset(&_systemInfo, 0, sizeof(_systemInfo));
    strlcpy(_systemInfo.hardware, hardware.c_str(), sizeof(_systemInfo.hardware));
    strlcpy(_systemInfo.version, version.c_str(), sizeof(_systemInfo.version));
    _systemInfo.protocol_version = gm_proto::PROTOCOL_VERSION;
    _systemInfo.has_capabilities = true;
    _systemInfo.capabilities = capabilities;

    // Mirror system info onto the legacy read-only characteristic in the old
    // JSON shape (plus "pv"), so pre-framing tools can still read it.
    char json[224];
    snprintf(json, sizeof(json), "{\"hw\":\"%s\",\"v\":\"%s\",\"pv\":%u,\"cp\":{\"ps\":%s,\"dm\":%s,\"led\":%s,\"tof\":%s}}",
             hardware.c_str(), version.c_str(), static_cast<unsigned>(gm_proto::PROTOCOL_VERSION),
             capabilities.pressure ? "true" : "false", capabilities.dimming ? "true" : "false",
             capabilities.led_control ? "true" : "false", capabilities.tof ? "true" : "false");
    _ble.setInfo(json);
}

void GaggiMateServer::pushSystemInfo() {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_system_info_tag;
    p.content.system_info = _systemInfo;
    _endpoint.send(p);
}

gm::Payload GaggiMateServer::buildSensorData(float temperature, float pressure, float puckFlow, float pumpFlow,
                                             float puckResistance, float pumpPower, float heaterPower, float waterPumped) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_sensor_tag;
    p.content.sensor.boilers_count = 1; // boiler 0; schema allows more
    p.content.sensor.boilers[0].index = 0;
    p.content.sensor.boilers[0].temperature = temperature;
    p.content.sensor.boilers[0].pressure = pressure;
    p.content.sensor.boilers[0].power = heaterPower;
    p.content.sensor.puck_flow = puckFlow;
    p.content.sensor.pump_flow = pumpFlow;
    p.content.sensor.puck_resistance = puckResistance;
    p.content.sensor.pump_power = pumpPower;
    p.content.sensor.water_pumped = waterPumped;
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

gm::Payload GaggiMateServer::buildScaleMeasurement(float weight, float cell1Weight, float cell2Weight, bool cell1Valid,
                                                   bool cell2Valid) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_scale_tag;
    p.content.scale.weight = weight;
    p.content.scale.cell1_weight = cell1Weight;
    p.content.scale.cell2_weight = cell2Weight;
    p.content.scale.cell1_valid = cell1Valid;
    p.content.scale.cell2_valid = cell2Valid;
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

// Telemetry (sensor / volumetric / ToF) is fire-and-forget: self-refreshing, so skip ACK chatter; the rest stays reliable.
void GaggiMateServer::sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance,
                                     float pumpPower, float heaterPower) {
    _endpoint.sendUnreliable(buildSensorData(temperature, pressure, puckFlow, pumpFlow, puckResistance, pumpPower, heaterPower));
}

void GaggiMateServer::sendButtonState(uint8_t index, bool pressed) { _endpoint.send(buildButtonState(index, pressed)); }

void GaggiMateServer::sendAutotuneResult(float kp, float ki, float kd, float kf) {
    _endpoint.send(buildAutotuneResult(kp, ki, kd, kf));
}

void GaggiMateServer::sendVolumetricMeasurement(float volume) { _endpoint.sendUnreliable(buildVolumetricMeasurement(volume)); }

void GaggiMateServer::sendScaleMeasurement(float weight, float cell1Weight, float cell2Weight, bool cell1Valid, bool cell2Valid) {
    _endpoint.sendUnreliable(buildScaleMeasurement(weight, cell1Weight, cell2Weight, cell1Valid, cell2Valid));
}

void GaggiMateServer::sendTofMeasurement(uint32_t distance) { _endpoint.sendUnreliable(buildTofMeasurement(distance)); }

void GaggiMateServer::sendError(int code) { _endpoint.send(buildError(code)); }

void GaggiMateServer::registerHandlers() {
    _endpoint.on(gaggimate_Payload_ping_tag, [this](const gm::Payload &) {
        // The connect-time SystemInfo can beat the display's receive path; a ping proves the link, so resend it once.
        if (!_sentSystemInfoAfterHandshake) {
            _sentSystemInfoAfterHandshake = true;
            pushSystemInfo();
        }
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
    _endpoint.on(gaggimate_Payload_heater_tag, [this](const gm::Payload &p) {
        if (_heaterSettingsCb)
            _heaterSettingsCb(p.content.heater);
    });
    _endpoint.on(gaggimate_Payload_pump_model_tag, [this](const gm::Payload &p) {
        if (_pumpSettingsCb)
            _pumpSettingsCb(p.content.pump_model);
    });
    _endpoint.on(gaggimate_Payload_autotune_tag, [this](const gm::Payload &p) {
        if (_autotuneCb)
            _autotuneCb(p.content.autotune.test_time, p.content.autotune.samples, p.content.autotune.heater_wattage);
    });
    _endpoint.on(gaggimate_Payload_machine_hardware_tag, [this](const gm::Payload &p) {
        if (_machineHardwareCb)
            _machineHardwareCb(p.content.machine_hardware);
    });
    _endpoint.on(gaggimate_Payload_pressure_scale_tag, [this](const gm::Payload &p) {
        if (_pressureScaleCb)
            _pressureScaleCb(p.content.pressure_scale.scale);
    });
    _endpoint.on(gaggimate_Payload_tare_tag, [this](const gm::Payload &) {
        if (_tareCb)
            _tareCb();
    });
    _endpoint.on(gaggimate_Payload_hardware_scale_tare_tag, [this](const gm::Payload &) {
        if (_hardwareScaleTareCb)
            _hardwareScaleTareCb();
    });
    _endpoint.on(gaggimate_Payload_scale_factors_tag, [this](const gm::Payload &p) {
        if (_scaleFactorsCb)
            _scaleFactorsCb(p.content.scale_factors.scale_factor1, p.content.scale_factors.scale_factor2,
                            static_cast<uint16_t>(p.content.scale_factors.sample_rate_sps),
                            p.content.scale_factors.idle_filter_alpha, p.content.scale_factors.active_filter_alpha);
    });
    _endpoint.on(gaggimate_Payload_led_tag, [this](const gm::Payload &p) {
        if (!_ledCb)
            return;
        // One message carries every changed channel; apply them in order.
        for (pb_size_t i = 0; i < p.content.led.channels_count; i++) {
            const auto &led = p.content.led.channels[i];
            if (led.channel > BARISTA_LED_CHANNEL || led.effect > 3)
                continue;
            if (led.channel >= SYSTEM_LED_CHANNEL &&
                (led.min_brightness > led.brightness || led.cycle_time_ms < MIN_LED_CYCLE_MS ||
                 led.cycle_time_ms > MAX_LED_CYCLE_MS))
                continue;
            _ledCb(led.channel, led.brightness, static_cast<LedEffect>(led.effect), led.min_brightness, led.cycle_time_ms);
        }
    });
}

void GaggiMateServer::sendMachineHardwareStatus(uint32_t hash, bool ready, bool error) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_machine_hardware_status_tag;
    p.content.machine_hardware_status.hash = hash;
    p.content.machine_hardware_status.ready = ready;
    p.content.machine_hardware_status.error = error;
    _endpoint.send(p);
}
