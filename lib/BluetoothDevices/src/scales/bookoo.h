#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEUtils.h>
#include <NimBLEScan.h>
#include <array>
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

  // Request Ultra shutdown (firmware V4.0.0+; ignored while charging).
  // Does nothing if disconnected or the model is not Ultra.
  void shutdown() override;

  // Capability overrides — Bookoo parses all of these out of the 20-byte
  // weight notification (0x0B). See decodeAndHandleNotification() for layout.
  bool hasFlowRate() const override { return true; }
  bool hasBatteryLevel() const override { return true; }
  bool hasScaleTimer() const override { return true; }
  bool hasTimerControl() const override { return true; }
  bool hasWeightUnit() const override { return true; }
  // NOTE: byte 18 of the weight notification is "auto-mode stop condition" on
  // Ultra-tier scales and reserved (0x00) on Mini. Without a way to identify
  // Ultra vs Mini at discovery time we can't claim this safely — consumers
  // reading getAutoModeStopCondition() on a Mini would get a meaningless 0.
  // Leaving hasAutoModeStopCondition() at its default (false) until an
  // Ultra-specific subclass or discovery path exists.

  // Ask the scale to turn off its own flow-rate EMA so firmware consumers
  // see raw native flow instead of double-filtered output. Idempotent;
  // safe to call repeatedly. Does nothing if disconnected.
  void disableScaleSmoothing();

private:
  enum class AdvancedOption : uint8_t {
    AUTO_SHUTDOWN,
    KEEPALIVE_HEARTBEAT,
    COUNT
  };

  struct AdvancedOptions {
    struct State {
      const char* name;
      bool enabled;
    };

    std::array<State, static_cast<size_t>(AdvancedOption::COUNT)> states = {{
      { "auto shutdown", false },
      { "keepalive heartbeat", false },
    }};

    bool isEnabled(AdvancedOption option) const {
      return states[static_cast<size_t>(option)].enabled;
    }

    void enable(AdvancedOption option) {
      states[static_cast<size_t>(option)].enabled = true;
    }

    auto begin() const { return states.begin(); }
    auto end() const { return states.end(); }
  };

  AdvancedOptions advancedOptions;

  enum class Model : uint8_t {
    BOOKOO_SC,
    BOOKOO_SC_U,
    UNKNOWN
  };

  Model getModel() const;

  uint32_t lastHeartbeat = 0;

  bool markedForReconnection = false;

  NimBLERemoteService* service;
  NimBLERemoteCharacteristic* weightCharacteristic;
  NimBLERemoteCharacteristic* commandCharacteristic;

  std::vector<uint8_t> dataBuffer;

  bool performConnectionHandshake();
  void subscribeToNotifications();

  void checkForAdvancedFeatures();
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
