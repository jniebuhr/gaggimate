#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEUtils.h>
#include <NimBLEScan.h>
#include <vector>
#include <memory>

enum class BookooMessageType : uint8_t {
  SYSTEM = 0x0A,
  WEIGHT = 0x0B
};

class BookooScales : public RemoteScales {

public:
  BookooScales(const DiscoveredDevice& device);
  void update() override;
  bool connect() override;
  void disconnect() override;
  bool isConnected() override;
  bool tare() override;

  void startTimer() override;
  void stopTimer() override;
  void resetTimer() override;

  // Capability overrides — Bookoo parses all of these out of the 20-byte
  // weight notification (0x0B). See decodeAndHandleNotification() for layout.
  bool hasFlowRate() const override { return true; }
  bool hasBatteryLevel() const override { return true; }
  bool hasScaleTimer() const override { return true; }
  bool hasTimerControl() const override { return true; }
  bool hasWeightUnit() const override { return true; }
  // Ultra reports an auto-mode stop condition in byte 18 of the weight
  // notification (0 = stop on liquid-flow-stop, 1 = stop on container-removal);
  // Mini always sends 0x00 (reserved). Gate this capability on Ultra detection
  // via the advertising name (BOOKOO_SC_U prefix) — see isUltra_ in the
  // constructor. Consumers reading getAutoModeStopCondition() on a Mini would
  // otherwise see a misleading 0.
  bool hasAutoModeStopCondition() const override { return isUltra_; }

  // True when the advertised name marks this device as an Ultra (BOOKOO_SC_U
  // prefix). Mini (and unknown future models) default to false.
  bool isUltra() const { return isUltra_; }

  // Ultra-only commands. No-op on Mini scales. See the Bookoo Ultra protocol
  // spec for byte-level details:
  //   https://github.com/BooKooCode/OpenSource/blob/main/bookoo_ultra_scale/protocols.md
  //
  // setAutoModeStopConditionOnScale: command 0x0B, writes the scale's own
  // auto-mode stop condition (0 = liquid-flow-stop, 1 = container-removal).
  // Only meaningful if the scale is in auto-mode; does not affect GaggiMate's
  // own brew-by-weight flow (which uses Timer mode).
  void setAutoModeStopConditionOnScale(bool onContainerRemoval);

  // calibrate: command 0x09, triggers factory calibration. Only effective
  // when the scale is physically in weight-mode; no-op otherwise and on Mini.
  void calibrate();

  // Ask the scale to turn off its own flow-rate EMA so firmware consumers
  // see raw native flow instead of double-filtered output. Idempotent;
  // safe to call repeatedly. Does nothing if disconnected.
  void disableScaleSmoothing();

private:
  uint32_t lastHeartbeat = 0;

  bool markedForReconnection = false;

  // Set once at construction time from the advertising name. Ultra devices
  // advertise as BOOKOO_SC_U<...>; Mini as BOOKOO_SC_M<...>. Default false
  // (Mini-compatible) for any name that doesn't match the Ultra prefix so
  // we never accidentally enable Ultra-only commands on a Mini.
  const bool isUltra_;

  NimBLERemoteService* service;
  NimBLERemoteCharacteristic* weightCharacteristic;
  NimBLERemoteCharacteristic* commandCharacteristic;

  std::vector<uint8_t> dataBuffer;

  bool performConnectionHandshake();
  void subscribeToNotifications();

  void sendMessage(const uint8_t* payload, size_t length, bool waitResponse = false);
  void sendEvent(const uint8_t* payload, size_t length);
  void sendHeartbeat();
  void sendNotificationRequest();
  void sendId();
  void notifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, uint8_t* pData, size_t length, bool isNotify);
  bool decodeAndHandleNotification();
};

class BookooScalesPlugin {
public:
  static void apply() {
    RemoteScalesPlugin plugin = RemoteScalesPlugin{
      .id = "plugin-bookoo",
      .handles = [](const DiscoveredDevice& device) { return BookooScalesPlugin::handles(device); },
      .initialise = [](const DiscoveredDevice& device) -> std::unique_ptr<RemoteScales> { return std::make_unique<BookooScales>(device); },
    };
    RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
  }
private:
  static bool handles(const DiscoveredDevice& device) {
    const std::string& deviceName = device.getName();
    return !deviceName.empty() && (deviceName.find("BOOKOO_SC") == 0);
  }
};
