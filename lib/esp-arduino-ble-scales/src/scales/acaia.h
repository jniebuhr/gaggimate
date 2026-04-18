#pragma once
#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <NimBLEUtils.h>
#include <NimBLEScan.h>
#include <vector>
#include <memory>

enum class AcaiaMessageType : uint8_t {
  SYSTEM = 0x00,
  TARE = 0x04,
  HANDSHAKE = 0x06,
  INFO = 0x07,
  STATUS = 0x08,
  IDENTIFY = 0x0B,
  EVENT = 0x0C,
};

class AcaiaScales : public RemoteScales {

public:
  AcaiaScales(const DiscoveredDevice& device);
  void update() override;
  bool connect() override;
  void disconnect() override;
  bool isConnected() override;
  bool tare() override;

private:
  std::string weightUnits;
  float time;
  uint8_t battery;

  uint32_t lastHeartbeat = 0;

  bool markedForReconnection = false;

  NimBLERemoteService* service;
  NimBLERemoteCharacteristic* weightCharacteristic;
  NimBLERemoteCharacteristic* commandCharacteristic;

  std::vector<uint8_t> dataBuffer;

  bool performConnectionHandshake();
  void subscribeToNotifications();

  void sendMessage(AcaiaMessageType msgType, const uint8_t* payload, size_t length, bool waitResponse = false);
  void sendEvent(const uint8_t* payload, size_t length);
  void sendHeartbeat();
  void sendNotificationRequest();
  void sendId();
  void notifyCallback(NimBLERemoteCharacteristic* pBLERemoteCharacteristic, uint8_t* pData, size_t length, bool isNotify);
  bool decodeAndHandleNotification();
  void handleScaleEventPayload(const uint8_t* pData, size_t length);
  void handleScaleStatusPayload(const uint8_t* pData, size_t length);
  float decodeWeight(const uint8_t* weightPayload);
  float decodeTime(const uint8_t* timePayload);
  
  // Helper to identify Umbra model scales which use slightly different BLE characteristics
  bool isUmbraModel() const;
};

class ScaleStatus {
public:
  ScaleStatus(uint8_t battery, const std::string& units, uint8_t auto_off, bool beep_on)
    : battery(battery), units(units), auto_off(auto_off), beep_on(beep_on) {
  }

private:
  uint8_t battery;
  std::string units;
  uint8_t auto_off;
  bool beep_on;
};

class AcaiaScalesPlugin {
public:
  static void apply() {
    RemoteScalesPlugin plugin = RemoteScalesPlugin{
      .id = "plugin-acaia",
      .handles = [](const DiscoveredDevice& device) { return AcaiaScalesPlugin::handles(device); },
      .initialise = [](const DiscoveredDevice& device) -> std::unique_ptr<RemoteScales> { return std::make_unique<AcaiaScales>(device); },
    };
    RemoteScalesPluginRegistry::getInstance()->registerPlugin(plugin);
  }
private:
  static bool handles(const DiscoveredDevice& device) {
    const std::string& deviceName = device.getName();
    return !deviceName.empty() && (
      deviceName.find("ACAIA") == 0
      || deviceName.find("PYXIS") == 0
      || deviceName.find("LUNAR") == 0
      || deviceName.find("PEARL") == 0
      || deviceName.find("PROCH") == 0
      || deviceName.find("UMBRA") == 0);
  }
};
