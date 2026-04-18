#include "timemore.h"
#include "remote_scales_plugin_registry.h"


enum class TimemoreEventType : uint8_t {
  WEIGHT = 0x10,
};

const size_t RECEIVE_PROTOCOL_LENGTH = 9;

const NimBLEUUID serviceUUID("181D");
const NimBLEUUID weightCharacteristicUUID("2A9D");
const NimBLEUUID commandCharacteristicUUID("553f4e49-bf21-4468-9c6c-0e4fb5b17697");

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
TimemoreScales::TimemoreScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool TimemoreScales::connect() {
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

void TimemoreScales::disconnect() {
  RemoteScales::clientCleanup();
}

bool TimemoreScales::isConnected() {
  return RemoteScales::clientIsConnected();
}

void TimemoreScales::update() {
  if (markedForReconnection) {
    RemoteScales::log("Marked for disconnection. Will attempt to reconnect.\n");
    RemoteScales::clientCleanup();
    connect();
    markedForReconnection = false;
  }
  else {
    sendHeartbeat();
  }
}

bool TimemoreScales::tare() {
  if (!isConnected()) return false;
  uint8_t payload[] = { 0x00 };
  sendMessage(TimemoreMessageType::TARE, payload, sizeof(payload));
  return true;
};

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/
void TimemoreScales::notifyCallback(
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

bool TimemoreScales::decodeAndHandleNotification() {
  // Minimum message length check
  if (dataBuffer.size() < RECEIVE_PROTOCOL_LENGTH) {
    return false;
  }

  // Handle different message types
  TimemoreEventType messageType = static_cast<TimemoreEventType>(dataBuffer[0]);
  if (messageType == TimemoreEventType::WEIGHT) {
    // 10 78 08 00 00 78 08 00 00
    //   |___________|___________|
    // Dripper Weight|Scale Weight
    // Both are little-endian 32-bit integer
    // E.g. 78 08 00 00 = 2168 / 10 = 216.8g

    //float_t dripperWeight = dataBuffer[1] | (dataBuffer[2] << 8) | (dataBuffer[3] << 16) | (dataBuffer[4] << 24);
    float_t scaleWeight = dataBuffer[5] | (dataBuffer[6] << 8) | (dataBuffer[7] << 16) | (dataBuffer[8] << 24);

    RemoteScales::setWeight(scaleWeight / 10.0f); // Convert to floating point
  }
  else {
    RemoteScales::log("Unknown message type %02X: %s\n", messageType, RemoteScales::byteArrayToHexString(dataBuffer.data(), dataBuffer.size()).c_str());
  }

  // Remove processed message from the buffer
  dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + RECEIVE_PROTOCOL_LENGTH);

  // Return whether there's more data to process
  return dataBuffer.size() >= RECEIVE_PROTOCOL_LENGTH;
}

bool TimemoreScales::performConnectionHandshake() {
  RemoteScales::log("Performing handshake\n");

  service = RemoteScales::clientGetService(serviceUUID);
  if (service != nullptr) {
    RemoteScales::log("Got Service\n");
  }
  else {
    clientCleanup();
    return false;
  }
  RemoteScales::log("Got Service\n");

  weightCharacteristic = service->getCharacteristic(weightCharacteristicUUID);
  commandCharacteristic = service->getCharacteristic(commandCharacteristicUUID);

  if (weightCharacteristic == nullptr || commandCharacteristic == nullptr) {
    clientCleanup();
    return false;
  }
  RemoteScales::log("Got weightCharacteristic and commandCharacteristic\n");

  // Subscribe
  NimBLERemoteDescriptor* notifyDescriptor = weightCharacteristic->getDescriptor(NimBLEUUID((uint16_t)0x2902));
  RemoteScales::log("Got notifyDescriptor\n");
  if (notifyDescriptor != nullptr) {
    uint8_t value[2] = { 0x01, 0x00 };
    notifyDescriptor->writeValue(value, 2, true);
  }
  else {
    clientCleanup();
    return false;
  }

  sendNotificationRequest();
  RemoteScales::log("Sent notification request\n");
  lastHeartbeat = millis();
  return true;
}

void TimemoreScales::sendNotificationRequest() {
  uint8_t payload[] = { 0x02, 0x00 };
  sendMessage(TimemoreMessageType::WEIGHT, payload, 2);
}

void TimemoreScales::sendHeartbeat() {
  if (!isConnected()) {
    return;
  }

  uint32_t now = millis();
  if (now - lastHeartbeat < 2000) {
    return;
  }

  uint8_t payload[] = { 0x00 };
  sendMessage(TimemoreMessageType::WEIGHT, payload, 1);
  lastHeartbeat = now;
}

void TimemoreScales::subscribeToNotifications() {
  RemoteScales::log("subscribeToNotifications\n");

  auto callback = [this](NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
    notifyCallback(characteristic, data, length, isNotify);
  };

  if (weightCharacteristic->canIndicate()) {
    weightCharacteristic->subscribe(false, callback, true);
  }
}

void TimemoreScales::sendMessage(TimemoreMessageType msgType, const uint8_t* payload, size_t length, bool waitResponse) {
  if (msgType == TimemoreMessageType::TARE) {
    commandCharacteristic->writeValue(payload, length, true);
  } else if (msgType == TimemoreMessageType::WEIGHT) {
    weightCharacteristic->writeValue(payload, length, true);
  }
}