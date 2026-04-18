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

class RemoteScales {

public:
  using LogCallback = void (*)(std::string);

  float getWeight() const { return weight; }

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

  ~RemoteScales() { clientCleanup(); }
protected:
  RemoteScales(const DiscoveredDevice& device);
  const DiscoveredDevice& getDevice() const { return device; }

  bool clientConnect();
  void clientCleanup();
  bool clientIsConnected();
  NimBLERemoteService* clientGetService(const NimBLEUUID uuid);

  void setWeight(float newWeight);
  void log(std::string msgFormat, ...);
  std::string byteArrayToHexString(const uint8_t* byteArray, size_t length);

private:
  using WeightCallback = void (*)(float);

  float weight = 0.f;

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
