// Mock of the display-side NanoPbComm facade. Same public surface the firmware
// uses, but instead of NimBLE it drives a local MockController and fires the
// response callbacks directly. Shadows lib/NanoPbComm/src/GaggiMateClient.h in
// the simulator build.
#pragma once

#include "GaggiMateComm.h"
#include "MockController.h"
#include "NimBLEClient.h"
#include <Arduino.h>
#include <cstdint>
#include <functional>
#include <vector>

// The firmware references unqualified `vector` in some signatures (it gets it
// transitively on-device); make it available wherever the comms header lands.
using std::vector;

// Protocol version the firmware checks against; report the same so there's no
// "protocol mismatch" path in the simulator.
namespace gm_proto {
static constexpr uint32_t PROTOCOL_VERSION = 3;
}

// Stand-in for the nanopb gm::Payload: a tagged command the build*() helpers
// produce and send()/sendBatch() apply to the MockController.
namespace gm {
struct Payload {
    enum Type { None, Ping, Boiler, Pump, Relay, Pid, PumpSettings, Autotune, PressureScale, Tare, Led } type = None;
    BoilerCommand boiler;
    PumpCommand pump;
    RelayCommand relay;
};
} // namespace gm

class GaggiMateClient {
  public:
    using ConnectionCallback = std::function<void(bool connected)>;
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

    bool isReadyForConnection() const { return _initialized; }
    bool connectToServer();
    bool isConnected() const { return _connected; }
    void disconnect() { _connected = false; }

    uint32_t getLatencyMs() const { return 18; }
    uint32_t getLastLatencyMs() const { return 18; }
    bool hasLatency() const { return _connected; }
    void setLowLatency(bool) {}
    NimBLEClient *getClient() const { return const_cast<NimBLEClient *>(&_nativeClient); }

    // build*: compose a command without sending.
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
    gm::Payload buildLedControl(const LedChannelCommand *channels, size_t count);

    void sendPing();
    void sendBoilerControl(uint8_t index, BoilerControlMode mode, float setpoint);
    void sendPumpControl(uint8_t index, PumpControlMode mode, float power, float pressure, float flow);
    void sendRelayControl(uint8_t index, bool open);
    void sendPidSettings(float kp, float ki, float kd, float kf);
    void sendPumpSettings(float a, float b, float c, float d, float commutationGain, float convergenceGain, float integralGain,
                          float maxPower);
    void sendAutotune(uint32_t testTime, uint32_t samples, uint32_t heaterWattage);
    void sendPressureScale(float scale);
    void tare();
    void sendLedControl(const LedChannelCommand *channels, size_t count);

    void send(const gm::Payload &payload);
    void sendBatch(const gm::Payload *payloads, size_t count);

    void onIncompatibleController(IncompatibleCallback cb) { _incompatibleCb = std::move(cb); }
    void onConnectionChanged(ConnectionCallback cb) { _connCb = std::move(cb); }
    void onSystemInfo(SystemInfoCallback cb) { _systemInfoCb = std::move(cb); }
    void onSensorData(SensorCallback cb) { _sensorCb = std::move(cb); }
    void onButtonState(ButtonCallback cb) { _buttonCb = std::move(cb); }
    void onAutotuneResult(AutotuneResultCallback cb) { _autotuneResultCb = std::move(cb); }
    void onVolumetricMeasurement(VolumetricCallback cb) { _volumetricCb = std::move(cb); }
    void onTofMeasurement(TofCallback cb) { _tofCb = std::move(cb); }
    void onError(ErrorCallback cb) { _errorCb = std::move(cb); }

  private:
    MockController _mock;
    NimBLEClient _nativeClient;

    bool _initialized = false;
    bool _connected = false;
    bool _pendingConnect = false;
    bool _autotunePending = false;
    uint32_t _autotuneDueMs = 0;

    ConnectionCallback _connCb;
    IncompatibleCallback _incompatibleCb;
    SystemInfoCallback _systemInfoCb;
    SensorCallback _sensorCb;
    ButtonCallback _buttonCb;
    AutotuneResultCallback _autotuneResultCb;
    VolumetricCallback _volumetricCb;
    TofCallback _tofCb;
    ErrorCallback _errorCb;
};
