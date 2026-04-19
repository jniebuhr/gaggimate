#pragma once
#include <NimBLEDevice.h>
#include <Arduino.h>
#include <vector>
#include <memory>
#include <lru_cache.h>


class DiscoveredDevice {
public:
  DiscoveredDevice(NimBLEAdvertisedDevice* device) :
  name(device->getName()), address(device->getAddress()), manufacturerData(device->getManufacturerData()), rssi(device->getRSSI()) {}
  const std::string& getName() const { return name; }
  const NimBLEAddress& getAddress() const { return address; }
  const std::string& getManufacturerData() const { return manufacturerData; }
  const int getRSSI() const { return rssi; }
private:
  std::string name;
  NimBLEAddress address;
  std::string manufacturerData;
  int rssi;
};

// Weight unit reported by the scale. Some BLE espresso scales can switch to
// ounces, which would silently corrupt volumetric targets unless the firmware
// detects the unit. UNKNOWN is the conservative default for drivers that don't
// report the field.
enum class ScaleWeightUnit : uint8_t { UNKNOWN = 0, GRAM = 1, OUNCE = 2 };

// Sentinel for "driver has no battery reading available".
constexpr uint8_t REMOTE_SCALES_BATTERY_UNKNOWN = 0xFF;

class RemoteScales {

public:
  using LogCallback = void (*)(std::string);

  // Core weight (always available).
  float getWeight() const { return weight; }

  // Optional native fields. Drivers that parse these should call the matching
  // protected setters from their notification handler AND override the
  // matching hasX() virtuals to return true. Defaults are safe no-ops for the
  // drivers (Acaia, Decent, Felicita, Timemore, ...) that only parse weight.
  float getFlowRate() const { return flowRate; }            // g/s, native from scale when available
  uint8_t getBatteryLevel() const { return batteryLevel; }  // 0-100 %, or REMOTE_SCALES_BATTERY_UNKNOWN
  uint32_t getScaleTimerMs() const { return scaleTimerMs; } // scale's internal stopwatch
  ScaleWeightUnit getWeightUnit() const { return weightUnit; }
  uint8_t getAutoModeStopCondition() const { return autoModeStopCondition; } // driver-defined

  // Capability flags. Default false; each driver overrides to true for the
  // fields it actually parses. Consumers should check these before trusting
  // the corresponding getter.
  virtual bool hasFlowRate() const { return false; }
  virtual bool hasBatteryLevel() const { return false; }
  virtual bool hasScaleTimer() const { return false; }
  virtual bool hasWeightUnit() const { return false; }
  virtual bool hasAutoModeStopCondition() const { return false; }

  void setWeightUpdatedCallback(void (*callback)(float), bool onlyChanges = false);
  void setLogCallback(LogCallback logCallback) { this->logCallback = logCallback; }

  std::string getDeviceName() const { return device.getName(); }
  std::string getDeviceAddress() const { return device.getAddress().toString(); }
  int getRSSI() const { return client != nullptr ? client->getRssi() : 0; }

  virtual bool tare() = 0;
  virtual bool isConnected() = 0;
  virtual bool connect() = 0;
  virtual void disconnect() = 0;
  virtual void update() = 0;

  virtual ~RemoteScales() { clientCleanup(); }
protected:
  RemoteScales(const DiscoveredDevice& device);
  const DiscoveredDevice& getDevice() const { return device; }

  bool clientConnect();
  void clientCleanup();
  bool clientIsConnected();
  NimBLERemoteService* clientGetService(const NimBLEUUID uuid);

  void setWeight(float newWeight);

  // Setters for optional fields. Drivers that parse these call from their
  // notification handler. Stored centrally so consumers can read via the
  // public getters without caring which driver the scale is.
  void setFlowRate(float newFlow) { flowRate = newFlow; }
  void setBatteryLevel(uint8_t pct) { batteryLevel = pct; }
  void setScaleTimerMs(uint32_t t) { scaleTimerMs = t; }
  void setWeightUnit(ScaleWeightUnit u) { weightUnit = u; }
  void setAutoModeStopCondition(uint8_t c) { autoModeStopCondition = c; }

  void log(std::string msgFormat, ...);
  std::string byteArrayToHexString(const uint8_t* byteArray, size_t length);

private:
  using WeightCallback = void (*)(float);

  float weight = 0.f;
  float flowRate = 0.0f;
  uint8_t batteryLevel = REMOTE_SCALES_BATTERY_UNKNOWN;
  uint32_t scaleTimerMs = 0;
  ScaleWeightUnit weightUnit = ScaleWeightUnit::UNKNOWN;
  uint8_t autoModeStopCondition = 0;

  NimBLEClient* client = nullptr;
  DiscoveredDevice device;
  LogCallback logCallback = nullptr;
  WeightCallback weightCallback = nullptr;
  bool weightCallbackOnlyChanges = false;
};

// ---------------------------------------------------------------------------------------
// ---------------------------   RemoteScalesScanner    -----------------------------------
// ---------------------------------------------------------------------------------------
class RemoteScalesScanner : public NimBLEAdvertisedDeviceCallbacks {
private:
  bool isRunning = false;
  LRUCache alreadySeenAddresses = LRUCache(100);
  std::vector<DiscoveredDevice> discoveredScales;
  void cleanupDiscoveredScales();
  void onResult(NimBLEAdvertisedDevice* advertisedDevice) override;

public:
  std::vector<DiscoveredDevice> getDiscoveredScales() { return discoveredScales; }

  void initializeAsyncScan();
  void stopAsyncScan();
  void restartAsyncScan();
  bool isScanRunning() const;
};

// ---------------------------------------------------------------------------------------
// ---------------------------   RemoteScalesFactory    ----------------------------------
// ---------------------------------------------------------------------------------------

// This is a singleton class that is used to create RemoteScales objects from BLEAdvertisedDevice objects.
class RemoteScalesFactory {
public:
  std::unique_ptr<RemoteScales> create(DiscoveredDevice device);

  static RemoteScalesFactory* getInstance() {
    if (instance == nullptr) {
      instance = new RemoteScalesFactory();
    }
    return instance;
  }

  RemoteScalesFactory(RemoteScalesFactory& other) = delete;
  void operator=(const RemoteScalesFactory&) = delete;

private:
  static RemoteScalesFactory* instance;
  RemoteScalesFactory() {}  // Private constructor to enforce singleton
};
