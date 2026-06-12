#ifndef GAGGIMATE_CLIENT_H
#define GAGGIMATE_CLIENT_H

#include "Endpoint.h"
#include "GaggiMateComm.h"
#include "ble/BleClientTransport.h"
#include <Arduino.h>
#include <functional>

/**
 * Display-side protocol facade.
 *
 * Owns a BLE client transport + Endpoint and exposes semantic send methods and
 * typed response callbacks. The connect sequence is asynchronous: the link is
 * established via connectToServer(), and the controller's SystemInfo arrives as
 * a pushed message (onSystemInfo) which is when capability-dependent setup
 * should run.
 */
class GaggiMateClient {
  public:
    using ConnectionCallback = std::function<void(bool connected)>;
    // Argument is the raw legacy INFO characteristic (JSON), if readable.
    using IncompatibleCallback = std::function<void(const String &info)>;
    using SystemInfoCallback =
        std::function<void(const char *hardware, const char *version, uint32_t protocolVersion, bool dimming, bool pressure,
                           bool ledControl, bool tof, std::vector<uint32_t> addons)>;
    using SensorCallback =
        std::function<void(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance)>;
    using ButtonCallback = std::function<void(uint8_t index, bool pressed)>;
    using AutotuneResultCallback = std::function<void(float kp, float ki, float kd, float kf)>;
    using VolumetricCallback = std::function<void(float volume)>;
    using TofCallback = std::function<void(uint32_t distance)>;
    using ErrorCallback = std::function<void(int code)>;

    GaggiMateClient();

    void init(const String &deviceName);
    void loop();

    // Connection lifecycle (driven from the display's main loop).
    bool isReadyForConnection() const { return _transport.isReadyForConnection(); }
    bool connectToServer() { return _transport.connectToServer(); }
    bool isConnected() const { return _endpoint.isConnected(); }
    void disconnect() { _transport.disconnect(); }

    // BLE round-trip latency (ms) measured by the reliability layer (send -> ACK).
    // EWMA-smoothed; refreshed at least every ~2s by the keep-alive ping plus on
    // every control update. hasLatency() is false until the first ACK of a link.
    uint32_t getLatencyMs() const { return _endpoint.latencyMs(); }
    uint32_t getLastLatencyMs() const { return _endpoint.lastLatencyMs(); }
    bool hasLatency() const { return _endpoint.hasLatency(); }

    // Tight connection interval (responsive control) while active; relaxed when
    // idle to give the shared radio back to Wi-Fi.
    void setLowLatency(bool active) { _transport.setLowLatency(active); }

    // Native NimBLE client handle, used by ControllerOTA / status RSSI (OTA uses
    // its own BLE service, independent of this protocol).
    NimBLEClient *getClient() const { return _transport.getNativeClient(); }

    // Build a payload without sending (compose your own batch, then send()).
    gm::Payload buildPing();
    gm::Payload buildBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint);
    gm::Payload buildPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow);
    gm::Payload buildRelayControl(uint8_t index, bool open);
    gm::Payload buildPidSettings(float kp, float ki, float kd, float kf);
    gm::Payload buildPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain,
                                  float integralGain, float maxPower);
    gm::Payload buildAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage);
    gm::Payload buildPressureScale(float scale);
    gm::Payload buildTare();
    // Pack channel/brightness pairs into one LedControl payload; entries beyond
    // the schema's per-message cap (LedControl.channels max_count) are dropped.
    gm::Payload buildLedControl(const LedChannelCommand *channels, size_t count);

    // Commands (display -> controller)
    void sendPing();
    void sendBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint);
    void sendPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow);
    void sendRelayControl(uint8_t index, bool open); // index 0 = brew valve, 1 = alt relay
    void sendPidSettings(float kp, float ki, float kd, float kf);
    void sendPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain, float integralGain,
                          float maxPower);
    void sendAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage);
    void sendPressureScale(float scale);
    void tare();
    // Drive several LED channels in one message (avoids per-channel sends that
    // the outbound queue would coalesce down to a single channel).
    void sendLedControl(const LedChannelCommand *channels, size_t count);

    // Send a pre-built payload / batch of payloads (one frame). Compose batches
    // from build*() helpers -- e.g. the display's delta-based control update.
    void send(const gm::Payload &payload) { _endpoint.send(payload); }
    void sendBatch(const gm::Payload *payloads, size_t count) { _endpoint.sendBatch(payloads, count); }

    // Fired when the connected controller is missing the framed-comms
    // characteristics (old / incompatible firmware); link is kept for OTA.
    void onIncompatibleController(IncompatibleCallback cb) { _incompatibleCb = std::move(cb); }

    // Response registrations (controller -> display)
    void onConnectionChanged(ConnectionCallback cb) { _connCb = std::move(cb); }
    void onSystemInfo(SystemInfoCallback cb) { _systemInfoCb = std::move(cb); }
    void onSensorData(SensorCallback cb) { _sensorCb = std::move(cb); }
    void onButtonState(ButtonCallback cb) { _buttonCb = std::move(cb); }
    void onAutotuneResult(AutotuneResultCallback cb) { _autotuneResultCb = std::move(cb); }
    void onVolumetricMeasurement(VolumetricCallback cb) { _volumetricCb = std::move(cb); }
    void onTofMeasurement(TofCallback cb) { _tofCb = std::move(cb); }
    void onError(ErrorCallback cb) { _errorCb = std::move(cb); }

  private:
    BleClientTransport _transport;
    Endpoint _endpoint;

    ConnectionCallback _connCb;
    IncompatibleCallback _incompatibleCb;
    SystemInfoCallback _systemInfoCb;
    SensorCallback _sensorCb;
    ButtonCallback _buttonCb;
    AutotuneResultCallback _autotuneResultCb;
    VolumetricCallback _volumetricCb;
    TofCallback _tofCb;
    ErrorCallback _errorCb;

    void registerHandlers();
};

#endif // GAGGIMATE_CLIENT_H
