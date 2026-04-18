#include "remote_scales.h"
#include "remote_scales_plugin_registry.h"

// ---------------------------------------------------------------------------------------
// ------------------------   Common RemoteScales methods    ------------------------------
// ---------------------------------------------------------------------------------------

RemoteScales::RemoteScales(const DiscoveredDevice& device) : device(device) {}

void RemoteScales::log(std::string msgFormat, ...) {
  if (!this->logCallback) return;

  va_list args;
  va_start(args, msgFormat);
  int length = vsnprintf(nullptr, 0, msgFormat.c_str(), args); // Find length of string
  va_end(args); // End before restarting

  if (length < 0) {
    logCallback("Scale[" + device.getName() + "] Error: Invalid message format");
    return;
  }

  va_start(args, msgFormat); // Restart for the actual printing
  std::string formattedMessage(length + 1, '\0'); // Instantiate formatted strigng with correct length
  vsnprintf(&formattedMessage[0], length + 1, msgFormat.c_str(), args); // print formatted message in the string
  formattedMessage.resize(length); // Remove the trailing null character
  va_end(args);
  logCallback("Scale[" + device.getName() + "] " + formattedMessage);
}

void RemoteScales::setWeight(float newWeight) {
  float previousWeight = weight;
  weight = newWeight;

  if (weightCallback == nullptr) {
    return;
  }
  if (weightCallbackOnlyChanges && previousWeight == newWeight) {
    return;
  }
  weightCallback(newWeight);
}

void RemoteScales::setWeightUpdatedCallback(void (*callback)(float), bool onlyChanges) {
  weightCallbackOnlyChanges = onlyChanges;
  this->weightCallback = callback;
}

bool RemoteScales::clientConnect() {
  clientCleanup();
  log("Connecting to BLE client\n");
  client = NimBLEDevice::createClient(device.getAddress());
  return client->connect();
}

void RemoteScales::clientCleanup() {
  if (client == nullptr) {
    return;
  }
  log("Cleaning up BLE client\n");
  NimBLEDevice::deleteClient(client);
  client = nullptr;
}

NimBLERemoteService* RemoteScales::clientGetService(const NimBLEUUID uuid) {
  if (!clientIsConnected()) {
    log("Cannot get service, client is not connected\n");
    return nullptr;
  }
  return client->getService(uuid);
}

bool RemoteScales::clientIsConnected() { return client != nullptr && client->isConnected(); };

std::string RemoteScales::byteArrayToHexString(const uint8_t* byteArray, size_t length) {
  std::string hexString;
  hexString.reserve(length * 3); // Reserve space for the resulting string

  char hex[4];
  for (size_t i = 0; i < length; i++) {
    snprintf(hex, sizeof(hex), "%02X ", byteArray[i]);
    hexString.append(hex);
  }

  return hexString;
}


// ---------------------------------------------------------------------------------------
// ------------------------   RemoteScales methods    ------------------------------
// ---------------------------------------------------------------------------------------

void RemoteScalesScanner::initializeAsyncScan() {
  if (isRunning) return;
  cleanupDiscoveredScales();

  // We set the second parameter to true to prevent the library from storing BLEAdvertisedDevice objects
  // for devices we're not interested in. This is important because the library will otherwise run out of
  // memory after a while.
  NimBLEDevice::getScan()->setAdvertisedDeviceCallbacks(this, true);
  NimBLEDevice::getScan()->setInterval(500);
  NimBLEDevice::getScan()->setWindow(100);
  NimBLEDevice::getScan()->setMaxResults(0);
  NimBLEDevice::getScan()->setDuplicateFilter(false);
  NimBLEDevice::getScan()->setActiveScan(true);
  NimBLEDevice::getScan()->start(0, nullptr, false); // Set to 0 for continuous
  isRunning = true;
}

void RemoteScalesScanner::stopAsyncScan() {
  if (!isRunning) return;
  NimBLEDevice::getScan()->stop();
  NimBLEDevice::getScan()->clearResults();
  alreadySeenAddresses.cleanup();
  isRunning = false;
}

void RemoteScalesScanner::restartAsyncScan() {
  stopAsyncScan();
  initializeAsyncScan();
}

void RemoteScalesScanner::onResult(NimBLEAdvertisedDevice* advertisedDevice) {
  if (std::string addrStr(reinterpret_cast<const char*>(advertisedDevice->getAddress().getNative()), 6); alreadySeenAddresses.exists(addrStr)) {
    return;
  }
  if (RemoteScalesPluginRegistry::getInstance()->containsPluginForDevice(advertisedDevice)) {
    discoveredScales.emplace_back(advertisedDevice);
  }
}

void RemoteScalesScanner::cleanupDiscoveredScales() {
  discoveredScales.clear();
}

bool RemoteScalesScanner::isScanRunning() const {
  return isRunning;
}



// ---------------------------------------------------------------------------------------
// ------------------------   RemoteScalesFactory methods    -----------------------------
// ---------------------------------------------------------------------------------------
RemoteScalesFactory* RemoteScalesFactory::instance = nullptr;

std::unique_ptr<RemoteScales> RemoteScalesFactory::create(DiscoveredDevice device) {
  if (!RemoteScalesPluginRegistry::getInstance()->containsPluginForDevice(device)) {
    return nullptr;
  }
  return RemoteScalesPluginRegistry::getInstance()->initialiseRemoteScales(device);
}
