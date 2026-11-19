#include "eureka.h"
#include "remote_scales_plugin_registry.h"

const size_t RECEIVE_PROTOCOL_LENGTH = 11;

const NimBLEUUID serviceUUID("FFF0");
const NimBLEUUID weightCharacteristicUUID("FFF1");
const NimBLEUUID commandCharacteristicUUID("FFF2");

const uint8_t CMD_HEADER = 0xaa;
const uint8_t CMD_BASE = 0x02;
const uint8_t CMD_START_TIMER = 0x33;
const uint8_t CMD_STOP_TIMER = 0x34;
const uint8_t CMD_RESET_TIMER = 0x35;
const uint8_t CMD_TARE = 0x31;

const uint16_t CMD_UNIT_BASE = 0x0336;
const uint8_t CMD_UNIT_GRAM = 0x00;
const uint8_t CMD_UNIT_OUNCE = 0x01;
const uint8_t CMD_UNIT_ML = 0x02;

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
EurekaScales::EurekaScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool EurekaScales::connect() {
  if (RemoteScales::clientIsConnected()) {
    RemoteScales::log("Already connected\n");
    return true;
  }

  RemoteScales::log("Connecting to %s[%s]\n", RemoteScales::getDeviceName().c_str(), RemoteScales::getDeviceAddress().c_str());
  bool result = RemoteScales::clientConnect();
  if (!result) {
    RemoteScales::clientCleanup();
    return false;
  }

  if (!performConnectionHandshake()) {
    return false;
  }
  subscribeToNotifications();
  RemoteScales::setWeight(0.f);
  return true;
}

void EurekaScales::disconnect() {
  RemoteScales::clientCleanup();
}

bool EurekaScales::isConnected() {
  return RemoteScales::clientIsConnected();
}

void EurekaScales::update() {
  if (markedForReconnection) {
    RemoteScales::log("Marked for disconnection. Will attempt to reconnect.\n");
    RemoteScales::clientCleanup();
    connect();
    markedForReconnection = false;
  }
  else {
    sendHeartbeat();
    RemoteScales::log("Heartbeat sent.\n");
  }
}

bool EurekaScales::tare() {
  if (!isConnected()) return false;
  RemoteScales::log("Tare sent");
  uint8_t payload[6] = { CMD_HEADER, CMD_BASE, CMD_TARE, CMD_TARE };
  sendMessage(payload, sizeof(payload));

  return true;
};

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/
void EurekaScales::notifyCallback(
  NimBLERemoteCharacteristic* pBLERemoteCharacteristic,
  uint8_t* pData,
  size_t length,
  bool isNotify
) {
  dataBuffer.insert(dataBuffer.end(), pData, pData + length);
  bool result = true;
  while (result) {
    result = decodeAndHandleNotification();
  }
}

bool EurekaScales::decodeAndHandleNotification() {
  // Minimum message length check (11 bytes based on protocol definition)
  if (dataBuffer.size() < RECEIVE_PROTOCOL_LENGTH) {
    return false;
  }

  bool is_negative = dataBuffer[6];

  uint8_t productNumber = dataBuffer[0];

  size_t messageLength = dataBuffer.size();

  float weight = (dataBuffer[8] << 8) + dataBuffer[7];

  if (dataBuffer[6]) { // Check if the value is negative
    weight = -weight;
  }

  RemoteScales::setWeight(weight * 0.1f); // Convert to floating point

  // Remove processed message from the buffer
  dataBuffer.erase(dataBuffer.begin(), dataBuffer.end());

  // Return whether there's more data to process
  return false;
}

bool EurekaScales::performConnectionHandshake() {
  RemoteScales::log("Performing handshake\n");

  service = RemoteScales::clientGetService(serviceUUID);
  if (service != nullptr) {
    RemoteScales::log("Got Service\n");
  }
  else {
    clientCleanup();
    return false;
  }

  weightCharacteristic = service->getCharacteristic(weightCharacteristicUUID);
  commandCharacteristic = service->getCharacteristic(commandCharacteristicUUID);
  if (weightCharacteristic == nullptr || commandCharacteristic == nullptr) {
    clientCleanup();
    return false;
  }
  RemoteScales::log("Got weightCharacteristic and commandCharacteristic\n");

  return true;
}

void EurekaScales::sendHeartbeat() {
  if (!isConnected()) {
    return;
  }

  // No heartbeat necessary
}

void EurekaScales::subscribeToNotifications() {
  RemoteScales::log("subscribeToNotifications\n");

  auto callback = [this](NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
    notifyCallback(characteristic, data, length, isNotify);
    };

  if (weightCharacteristic->canNotify()) {
    RemoteScales::log("Registering callback for weight characteristic\n");
    weightCharacteristic->subscribe(true, callback);
  }

  if (commandCharacteristic->canNotify()) {
    RemoteScales::log("Registering callback for command characteristic\n");
    commandCharacteristic->subscribe(true, callback);
  }
}

void EurekaScales::sendMessage(const uint8_t* payload, size_t length, bool waitResponse) {
  auto bytes = std::make_unique<uint8_t[]>(length);
  memcpy(bytes.get(), payload, length);
  commandCharacteristic->writeValue(bytes.get(), length, waitResponse);
}
