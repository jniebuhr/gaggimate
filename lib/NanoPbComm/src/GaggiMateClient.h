#ifndef GAGGIMATE_CLIENT_H
#define GAGGIMATE_CLIENT_H

#include "Endpoint.h"
#include "GaggiMateComm.h"
#include "LinkSelector.h"
#include "ble/BleClientTransport.h"
#include "ble/BleOtaSender.h"
#include "uart/UartOtaSender.h"
#include "uart/UartTransport.h"
#include <Arduino.h>
#include <functional>
#include <memory>

// Display-side protocol facade: owns the links + Endpoint, exposes semantic sends and typed response callbacks.
// BLE and (if wired) UART search in parallel; UART takes the session whenever it is up, BLE is the fallback.
// Connecting is async: capability-dependent setup belongs in onSystemInfo, pushed by the controller after connect.
class GaggiMateClient {
  public:
    using ConnectionCallback = std::function<void(bool connected)>;
    // Argument is the raw legacy INFO characteristic (JSON), if readable.
    using IncompatibleCallback = std::function<void(const String &info)>;
    using SystemInfoCallback =
        std::function<void(const char *hardware, const char *version, uint32_t protocolVersion, bool dimming, bool pressure,
                           bool ledControl, bool tof, bool dualBoiler, std::vector<uint32_t> addons)>;
    using SensorCallback =
        std::function<void(float temperature, float temperature2, float pressure, float puckFlow, float pumpFlow,
                           float puckResistance, float pumpPower, float heaterPower, float waterPumped)>;
    using ButtonCallback = std::function<void(uint8_t index, bool pressed)>;
    using AutotuneResultCallback = std::function<void(float kp, float ki, float kd, float kf)>;
    using VolumetricCallback = std::function<void(float volume)>;
    using ScaleCallback =
        std::function<void(float weight, float cell1Weight, float cell2Weight, bool cell1Valid, bool cell2Valid)>;
    using SteamLevelCallback = std::function<void(bool low)>;
    using TankLevelCallback = std::function<void(bool present, bool full)>;
    using MachineHardwareCallback = std::function<void(uint32_t hash, bool ready, bool error)>;
    using TofCallback = std::function<void(uint32_t distance)>;
    using ErrorCallback = std::function<void(int code)>;

    GaggiMateClient();

    // Adds a wired link on `port`; call before init(). The display driver knows which pins reach the controller.
    void enableUart(uint8_t rxPin, uint8_t txPin, HardwareSerial &port = Serial1, uint32_t baud = gm_uart::DEFAULT_BAUD);
    void init(const String &deviceName);
    void loop();

    // BLE connection lifecycle (driven from the display's main loop); the UART link comes up by itself.
    bool isReadyForConnection();
    bool connectToServer() { return _ble.connectToServer(); }
    bool isConnected() const { return _endpoint.isConnected(); }
    void disconnect();

    // Link currently carrying the session; None while searching.
    LinkType getLinkType() const { return _link.activeType(); }
    // BLE signal strength in dBm; 0 without a BLE link.
    int getRssi() const;
    // Firmware transfer for the active link; BLE while searching, which also covers OTA-only legacy controllers.
    OtaSender *getOtaSender();

    // Forget the paired controller so the display can pair to a different one.
    void clearBonds() { _ble.clearBonds(); }

    // EWMA-smoothed send->ACK round-trip (ms); hasLatency() is false until the first ACK of a link.
    uint32_t getLatencyMs() const { return _endpoint.latencyMs(); }
    uint32_t getLastLatencyMs() const { return _endpoint.lastLatencyMs(); }
    bool hasLatency() const { return _endpoint.hasLatency(); }
    // Frames the display had to send again because no ACK arrived in time, since boot.
    uint32_t getRetransmits() const { return _endpoint.retransmits(); }
    // True once every queued command has been delivered and acknowledged.
    bool isIdle() { return _endpoint.isIdle(); }

    // Tight connection interval while active; relaxed when idle to give the shared radio back to Wi-Fi.
    void setLowLatency(bool active) { _ble.setLowLatency(active); }

    // Build a payload without sending (compose your own batch, then send()).
    gm::Payload buildPing();
    gm::Payload buildBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint);
    gm::Payload buildPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow);
    gm::Payload buildRelayControl(uint8_t index, bool open);
    gm::Payload buildHeaterSettings(float kp, float ki, float kd, float kf, bool heaterCoordinationEnabled, uint32_t handoverMs,
                                    float steamKp, float steamKi, float steamKd);
    gm::Payload buildPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain,
                                  float integralGain, float maxPower, float slipA, float slipB, float slipC, float slipD);
    gm::Payload buildAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage);
    gm::Payload buildPressureScale(float scale);
    gm::Payload buildTare();
    gm::Payload buildHardwareScaleTare();
    gm::Payload buildScaleFactors(float scaleFactor1, float scaleFactor2, uint16_t sampleRateSps = 10,
                                  float idleFilterAlpha = 0.80f, float activeFilterAlpha = 0.80f) {
        gm::Payload p = gaggimate_Payload_init_zero;
        p.which_content = gaggimate_Payload_scale_factors_tag;
        p.content.scale_factors.scale_factor1 = scaleFactor1;
        p.content.scale_factors.scale_factor2 = scaleFactor2;
        p.content.scale_factors.sample_rate_sps = sampleRateSps;
        p.content.scale_factors.idle_filter_alpha = idleFilterAlpha;
        p.content.scale_factors.active_filter_alpha = activeFilterAlpha;
        return p;
    }
    // Pack channel/brightness pairs into one LedControl payload; entries beyond
    // the schema's per-message cap (LedControl.channels max_count) are dropped.
    gm::Payload buildLedControl(const LedChannelCommand *channels, size_t count);

    // Commands (display -> controller)
    void sendPing();
    void sendBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint);
    void sendPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow);
    void sendRelayControl(uint8_t index, bool open); // index 0 = brew valve, 1 = alt relay
    void sendHeaterSettings(float kp, float ki, float kd, float kf, bool heaterCoordinationEnabled, uint32_t handoverMs,
                            float steamKp, float steamKi, float steamKd);
    void sendPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain, float integralGain,
                          float maxPower, float slipA, float slipB, float slipC, float slipD);
    void sendAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage);
    void sendPressureScale(float scale);
    void sendScaleFactors(float scaleFactor1, float scaleFactor2, uint16_t sampleRateSps = 10, float idleFilterAlpha = 0.80f,
                          float activeFilterAlpha = 0.80f) {
        _endpoint.send(buildScaleFactors(scaleFactor1, scaleFactor2, sampleRateSps, idleFilterAlpha, activeFilterAlpha));
    }
    void tare();
    void tareHardwareScale();
    // Drive several LED channels in one message; per-channel sends would coalesce down to a single channel.
    void sendLedControl(const LedChannelCommand *channels, size_t count);

    // Send a pre-built payload / batch of payloads (one frame), composed from the build*() helpers.
    void send(const gm::Payload &payload) { _endpoint.send(payload); }
    void sendBatch(const gm::Payload *payloads, size_t count) { _endpoint.sendBatch(payloads, count); }

    // Fired when the controller lacks the framed-comms characteristics (old firmware); link is kept for OTA.
    void onIncompatibleController(IncompatibleCallback cb) { _incompatibleCb = std::move(cb); }

    // Response registrations (controller -> display)
    void onConnectionChanged(ConnectionCallback cb) { _connCb = std::move(cb); }
    // A reliable frame was dropped after its retries; may fire on the BLE thread, so keep the callback trivial.
    void onSendFailed(std::function<void()> cb) { _endpoint.onSendFailed(std::move(cb)); }
    void onSystemInfo(SystemInfoCallback cb) { _systemInfoCb = std::move(cb); }
    void onSensorData(SensorCallback cb) { _sensorCb = std::move(cb); }
    void onButtonState(ButtonCallback cb) { _buttonCb = std::move(cb); }
    void onAutotuneResult(AutotuneResultCallback cb) { _autotuneResultCb = std::move(cb); }
    void onVolumetricMeasurement(VolumetricCallback cb) { _volumetricCb = std::move(cb); }
    void onScaleMeasurement(ScaleCallback cb) { _scaleCb = std::move(cb); }
    void onSteamLevel(SteamLevelCallback cb) { _steamLevelCb = std::move(cb); }
    void onTankLevel(TankLevelCallback cb) { _tankLevelCb = std::move(cb); }
    void onTofMeasurement(TofCallback cb) { _tofCb = std::move(cb); }
    void sendMachineHardware(const gm::MachineHardwareSettings &settings);
    void onMachineHardware(MachineHardwareCallback cb) { _machineHardwareCb = std::move(cb); }
    void onError(ErrorCallback cb) { _errorCb = std::move(cb); }

  private:
    BleClientTransport _ble;
    BleOtaSender _bleOta{_ble};
    // Allocated only on boards with a wired link; the frame buffers are a few KB of internal RAM.
    std::unique_ptr<UartTransport> _uart;
    std::unique_ptr<UartOtaSender> _uartOta;
    HardwareSerial *_uartPort = nullptr;
    uint8_t _uartRxPin = 0;
    uint8_t _uartTxPin = 0;
    uint32_t _uartBaud = gm_uart::DEFAULT_BAUD;
    // A controller found over BLE gets this long to show up on the wire before we connect by radio.
    static constexpr unsigned long UART_HEAD_START_MS = 500;
    unsigned long _bleReadySince = 0;
    LinkSelector _link;
    Endpoint _endpoint{_link};

    // Sole runner of the UART RX drain and the endpoint's send pump; woken by sends/ACKs/UART RX, else ticks at the idle
    // interval.
    TaskHandle_t _pumpTaskHandle = nullptr;
    static void pumpTask(void *arg);
    static constexpr uint32_t PUMP_TASK_STACK = 4096;
    static constexpr UBaseType_t PUMP_TASK_PRIORITY = 5;
    static constexpr uint32_t PUMP_IDLE_INTERVAL_MS = 10;

    ConnectionCallback _connCb;
    IncompatibleCallback _incompatibleCb;
    SystemInfoCallback _systemInfoCb;
    SensorCallback _sensorCb;
    TankLevelCallback _tankLevelCb;
    SteamLevelCallback _steamLevelCb;
    ButtonCallback _buttonCb;
    AutotuneResultCallback _autotuneResultCb;
    VolumetricCallback _volumetricCb;
    ScaleCallback _scaleCb;
    TofCallback _tofCb;
    MachineHardwareCallback _machineHardwareCb;
    ErrorCallback _errorCb;

    void registerHandlers();
    void onLinkSelected(LinkType active);
};

#endif // GAGGIMATE_CLIENT_H
