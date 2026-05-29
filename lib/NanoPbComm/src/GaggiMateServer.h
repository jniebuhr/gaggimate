#ifndef GAGGIMATE_SERVER_H
#define GAGGIMATE_SERVER_H

#include "Endpoint.h"
#include "GaggiMateComm.h"
#include "ble/BleServerTransport.h"
#include <Arduino.h>
#include <functional>

/**
 * Controller-side protocol facade.
 *
 * Owns a BLE server transport + Endpoint and exposes semantic send methods and
 * typed command callbacks. Pushes SystemInfo to the display on connect.
 */
class GaggiMateServer {
  public:
    using PingCallback = std::function<void()>;
    using BoilerCallback = std::function<void(uint8_t index, float setpoint)>;
    using PumpCallback = std::function<void(uint8_t index, PumpControlMode mode, float power, float pressure, float flow)>;
    using ValveCallback = std::function<void(uint8_t index, bool open)>;
    using AltCallback = std::function<void(bool open)>;
    using PidCallback = std::function<void(float kp, float ki, float kd, float kf)>;
    using PumpModelCallback = std::function<void(float a, float b, float c, float d)>;
    using AutotuneCallback = std::function<void(uint32_t testTime, uint32_t samples, uint32_t heaterWattage)>;
    using PressureScaleCallback = std::function<void(float scale)>;
    using TareCallback = std::function<void()>;
    using LedCallback = std::function<void(uint8_t channel, uint8_t brightness)>;

    GaggiMateServer();

    void init(const String &deviceName, const String &hardware, const String &version, bool dimming, bool pressure,
              bool ledControl, bool tof);
    bool isConnected() const { return _endpoint.isConnected(); }

    void setSystemInfo(const String &hardware, const String &version, bool dimming, bool pressure, bool ledControl, bool tof);

    // Responses (controller -> display)
    void sendSensorData(float temperature, float pressure, float puckFlow, float pumpFlow, float puckResistance);
    void sendButtonState(uint8_t index, bool pressed);
    void sendAutotuneResult(float kp, float ki, float kd, float kf);
    void sendVolumetricMeasurement(float volume);
    void sendTofMeasurement(uint32_t distance);
    void sendError(int code);

    // Command registrations (display -> controller)
    void onPing(PingCallback cb) { _pingCb = std::move(cb); }
    void onBoilerControl(BoilerCallback cb) { _boilerCb = std::move(cb); }
    void onPumpControl(PumpCallback cb) { _pumpCb = std::move(cb); }
    void onValveControl(ValveCallback cb) { _valveCb = std::move(cb); }
    void onAltControl(AltCallback cb) { _altCb = std::move(cb); }
    void onPidSettings(PidCallback cb) { _pidCb = std::move(cb); }
    void onPumpModelCoeffs(PumpModelCallback cb) { _pumpModelCb = std::move(cb); }
    void onAutotune(AutotuneCallback cb) { _autotuneCb = std::move(cb); }
    void onPressureScale(PressureScaleCallback cb) { _pressureScaleCb = std::move(cb); }
    void onTare(TareCallback cb) { _tareCb = std::move(cb); }
    void onLedControl(LedCallback cb) { _ledCb = std::move(cb); }

  private:
    BleServerTransport _transport;
    Endpoint _endpoint;
    gm::SystemInfo _systemInfo = gaggimate_SystemInfo_init_zero;

    PingCallback _pingCb;
    BoilerCallback _boilerCb;
    PumpCallback _pumpCb;
    ValveCallback _valveCb;
    AltCallback _altCb;
    PidCallback _pidCb;
    PumpModelCallback _pumpModelCb;
    AutotuneCallback _autotuneCb;
    PressureScaleCallback _pressureScaleCb;
    TareCallback _tareCb;
    LedCallback _ledCb;

    void registerHandlers();
    void pushSystemInfo();

    // Drives the endpoint send pump / retransmit independently of the
    // controller's (slow, 250ms) main loop, on the NimBLE core.
    TaskHandle_t _taskHandle = nullptr;
    static void pumpTask(void *arg);
};

#endif // GAGGIMATE_SERVER_H
