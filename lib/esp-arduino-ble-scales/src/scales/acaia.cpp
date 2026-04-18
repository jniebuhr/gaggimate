#include "acaia.h"
#include "remote_scales_plugin_registry.h"

/**
* Structure inside each packet.
* Checksums are calculated over Payload.
* ---------------------------------------------------------------
* |  0xEF  |  0xDD  |  0x00 |  0x00   | ....... | 0x00   | 0x00
* ---------------------------------------------------------------
* |     Header      |  Mesg |      Payload      |    Checksum
* |  byte1 |  byte2 |  Type | Length  |   Data  | byte1   | byte2
* ---------------------------------------------------------------
*
* Note: Acaia Umbra Lunar scales use the same protocol but with:
* - Different BLE service/characteristic UUIDs (fe40/fe41/fe42 instead of standard UUIDs)
* - Weight data in bytes 2-3 instead of 0-1 (big-endian order)
*/

enum class AcaiaHeader : uint8_t {
  HEADER1 = 0xEF,
  HEADER2 = 0xDD,
};

enum class AcaiaEventType : uint8_t {
  WEIGHT = 0x05,
  BATTERY = 0x06,
  TIMER = 0x07,
  KEY = 0x08,
  ACK = 0x0B,
};

enum class AcaiaEventKey : uint8_t {
  TARE = 0x05,
  START = 0x07,
  RESET = 0x08,
  STOP = 0x09,
};

const size_t HEADER_LENGTH = 3;
const size_t CHECKSUM_LENGTH = 2;
const size_t MIN_MESSAGE_LENGTH = HEADER_LENGTH + CHECKSUM_LENGTH + 1;

const NimBLEUUID serviceUUID("49535343-fe7d-4ae5-8fa9-9fafd205e455");
const NimBLEUUID weightCharacteristicUUID("49535343-1e4d-4bd9-ba61-23c647249616");
const NimBLEUUID commandCharacteristicUUID("49535343-8841-43f4-a8d4-ecbe34729bb3");

const NimBLEUUID oldServiceUUID("00001820-0000-1000-8000-00805f9b34fb");
const NimBLEUUID oldCharacteristicUUID("00002a80-0000-1000-8000-00805f9b34fb");

// Acaia Umbra Lunar uses different BLE UUIDs but the same protocol
const NimBLEUUID umbraServiceUUID("0000fe40-cc7a-482a-984a-7f2ed5b3e58f");
const NimBLEUUID umbraCommandCharacteristicUUID("0000fe41-8e22-4541-9d4c-21edae82ed19");
const NimBLEUUID umbraWeightCharacteristicUUID("0000fe42-8e22-4541-9d4c-21edae82ed19");

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
AcaiaScales::AcaiaScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool AcaiaScales::connect() {
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

void AcaiaScales::disconnect() {
  RemoteScales::clientCleanup();
}

bool AcaiaScales::isConnected() {
  return RemoteScales::clientIsConnected();
}

void AcaiaScales::update() {
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

bool AcaiaScales::tare() {
  if (!isConnected()) return false;
  uint8_t payload[] = { 0x00 };
  sendMessage(AcaiaMessageType::TARE, payload, sizeof(payload));
  return true;
};

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/
static void cleanupJunkData(std::vector<uint8_t>& dataBuffer);
static std::pair<uint8_t, uint8_t> calculateChecksum(const uint8_t* message, size_t length);

void AcaiaScales::notifyCallback(
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

bool AcaiaScales::decodeAndHandleNotification() {
  cleanupJunkData(dataBuffer);

  if (dataBuffer.size() < MIN_MESSAGE_LENGTH) {
    return false;
  }

  size_t messageLength = HEADER_LENGTH + dataBuffer[3] + CHECKSUM_LENGTH;
  if (messageLength > dataBuffer.size()) {
    return false;
  }

  uint8_t* payload = dataBuffer.data() + HEADER_LENGTH;
  size_t payloadLength = messageLength - (HEADER_LENGTH + CHECKSUM_LENGTH);

  auto checksumBytes = calculateChecksum(payload, payloadLength);
  if (checksumBytes.first != dataBuffer[messageLength - 2] || checksumBytes.second != dataBuffer[messageLength - 1]) {
    RemoteScales::log("Checksum failed: calc[%02X  %02X] but actual[%02X %02X]. Discarding.\n",
      checksumBytes.first, checksumBytes.second,
      dataBuffer[messageLength - 2], dataBuffer[messageLength - 1]
    );
    dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageLength);
    return false;
  }

  AcaiaMessageType messageType = static_cast<AcaiaMessageType>(dataBuffer[2]);

  if (messageType == AcaiaMessageType::EVENT) {
    handleScaleEventPayload(payload, payloadLength);
  }
  else if (messageType == AcaiaMessageType::STATUS) {
    handleScaleStatusPayload(payload, payloadLength);
  }
  else if (messageType == AcaiaMessageType::INFO) {
    RemoteScales::log("Got info message: %s\n", RemoteScales::byteArrayToHexString(dataBuffer.data(), messageLength).c_str());

    // For some reason, Acaia Pearl S sends this info message upon connection.
    // It can safely be ignored; otherwise, the scale will almost never successfully connect.
    if(RemoteScales::getDeviceName().find("PEARLS")!=0){
      // This normally means that something went wrong with the establishing a connection so we disconnect.
      markedForReconnection = true;
    }

  }
  else {
    RemoteScales::log("Unknown message type %02X: %s\n", messageType, RemoteScales::byteArrayToHexString(dataBuffer.data(), messageLength).c_str());
  }

  //Remove processed data packet from the buffer.
  dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageLength);
  return dataBuffer.size() >= MIN_MESSAGE_LENGTH;
}

void AcaiaScales::handleScaleEventPayload(const uint8_t* payload, size_t length) {
  AcaiaEventType eventType = static_cast<AcaiaEventType>(payload[1]);
  if (eventType == AcaiaEventType::WEIGHT) {
    RemoteScales::setWeight(decodeWeight(payload + 2));
  }
  else if (eventType == AcaiaEventType::ACK) {
    // Ignore for now.
    // Example: 0B 00 E0 05 5C 17 00 00 01 02 29 48
    // RemoteScales::log("ACK - %s\n", byteArrayToHexString(payload, length).c_str());
    // RemoteScales::log("Heartbeat response (weight: %0.1f time: %0.1f)\n", weight, time);
    // RemoteScales::setWeight(decodeWeight(payload + 4));
  }
  else if (eventType == AcaiaEventType::TIMER) {
    // Ignore for now
    // time = decodeTime(payload + 1);
    // RemoteScales::log("TIMER - %s", byteArrayToHexString(payload, length).c_str());
    // RemoteScales::log("Time:  %0.1f\n", time);
  }
  else if (eventType == AcaiaEventType::KEY) {
    // Ignore for now
    // AcaiaEventKey eventKey = static_cast<AcaiaEventKey>(payload[1]);
    // if (eventKey == AcaiaEventKey::TARE) {
    //   RemoteScales::setWeight(decodeWeight(payload + 2));
    //   RemoteScales::log("TARE - %s", byteArrayToHexString(payload, length).c_str());
    //   RemoteScales::log("Tare (weight:  %0.1f)\n", RemoteScales::getWeight());
    // }
    // else if (eventKey == AcaiaEventKey::START) {
    //   RemoteScales::setWeight(decodeWeight(payload + 2));
    //   RemoteScales::log("START - %s", byteArrayToHexString(payload, length).c_str());
    //   RemoteScales::log("Start (weight:  %0.1f)\n", RemoteScales::getWeight());
    // }
    // else if (eventKey == AcaiaEventKey::STOP) {
    //   time = decodeTime(payload + 2);
    //   RemoteScales::setWeight(decodeWeight(payload + 6));
    //   RemoteScales::log("STOP - %s", byteArrayToHexString(payload, length).c_str());
    //   RemoteScales::log("Stop (weight:  %0.1f, time:  %0.1f)\n", RemoteScales::getWeight(), time);
    // }
    // else if (eventKey == AcaiaEventKey::RESET) {
    //   time = decodeTime(payload + 2);
    //   RemoteScales::setWeight(decodeWeight(payload + 6));
    //   // 08 08 05 00 00 00 00 01 01 13 0E
    //   // 08 0A 05 03 00 00 00 01 01 18 0E
    //   RemoteScales::log("RESET - %s", byteArrayToHexString(payload, length).c_str());
    //   RemoteScales::log("Reset (weight:  %0.1f, time:  %0.1f)\n", RemoteScales::getWeight(), time);
    // }
    // else {
    //   RemoteScales::log("Unknown key %02X(%d) - %s\n", eventKey, eventKey, byteArrayToHexString(payload, length).c_str());
    // }
  }
  else {
    RemoteScales::log("unknown event type %02x(%d): %s\n", eventType, eventType, RemoteScales::byteArrayToHexString(payload, length).c_str());
  }
}

void AcaiaScales::handleScaleStatusPayload(const uint8_t* payload, size_t length) {
  battery = payload[1] & 0x7F;
  if (payload[2] == 2) {
    weightUnits = "grams";
  }
  else if (payload[2] == 5) {
    weightUnits = "ounces";
  }
  else {
    weightUnits = "";
  }
  // uint8_t auto_off = payload[4] * 5;
  // bool beep_on = (payload[6] == 1);
}

float AcaiaScales::decodeWeight(const uint8_t* weightPayload) {
  float value;
  uint8_t scaling;

  // Umbra scales use different byte positions for weight data
  if (isUmbraModel()) {
    // Umbra: weight is in bytes 2-3 (big-endian: byte 2 is MSB, byte 3 is LSB)
    value = (weightPayload[2] << 8) | weightPayload[3];
    scaling = weightPayload[4];
  } else {
    // Standard Acaia scales: weight is in bytes 0-1
    value = (weightPayload[1] << 8) | weightPayload[0];
    scaling = weightPayload[4];
  }

  switch (scaling) {
  case 1:
    value /= 10.0f;
    break;
  case 2:
    value /= 100.0f;
    break;
  case 3:
    value /= 1000.0f;
    break;
  case 4:
    value /= 10000.0f;
    break;
  default:
    RemoteScales::log("Invalid scaling %02X - %s \n", scaling, RemoteScales::byteArrayToHexString(weightPayload, 6).c_str());
    return -1;
  }

  if (weightPayload[5] & 0x02) {
    value *= -1.0f;
  }

  return value;
}

float AcaiaScales::decodeTime(const uint8_t* timePayload) {
  return timePayload[0] * 60.0f + timePayload[1] + timePayload[2] / 10.0f;
}

bool AcaiaScales::performConnectionHandshake() {
  RemoteScales::log("Performing handshake\n");

  if (RemoteScales::clientGetService(oldServiceUUID)) {
    service = RemoteScales::clientGetService(oldServiceUUID);
  }
  else if (RemoteScales::clientGetService(serviceUUID)) {
    service = RemoteScales::clientGetService(serviceUUID);
  }
  else if (RemoteScales::clientGetService(umbraServiceUUID)) {
    service = RemoteScales::clientGetService(umbraServiceUUID);
  }
  else {
    RemoteScales::log("No compatible service found\n");
    clientCleanup();
    return false;
  }

  if (service->getUUID().equals(umbraServiceUUID)) {
    // Umbra fe40 service uses fe41 for commands, fe42 for weight notifications
    weightCharacteristic = service->getCharacteristic(umbraWeightCharacteristicUUID);
    commandCharacteristic = service->getCharacteristic(umbraCommandCharacteristicUUID);
  }
  else if (service->getCharacteristic(oldCharacteristicUUID)) {
    weightCharacteristic = service->getCharacteristic(oldCharacteristicUUID);
    commandCharacteristic = service->getCharacteristic(oldCharacteristicUUID);
  }
  else {
    weightCharacteristic = service->getCharacteristic(weightCharacteristicUUID);
    commandCharacteristic = service->getCharacteristic(commandCharacteristicUUID);
  }

  if (weightCharacteristic == nullptr || commandCharacteristic == nullptr) {
    RemoteScales::log("Failed to find required characteristics\n");
    clientCleanup();
    return false;
  }
  RemoteScales::log("Got weightCharacteristic and commandCharacteristic\n");

  // Subscribe to notifications
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

  // Identify
  sendId();
  RemoteScales::log("Send ID\n");
  sendNotificationRequest();
  RemoteScales::log("Sent notification request\n");
  lastHeartbeat = millis();
  return true;
}

void AcaiaScales::sendId() {
  const uint8_t payload[] = { 0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d,0x2d };
  sendMessage(AcaiaMessageType::IDENTIFY, payload, 15, false);
}

void AcaiaScales::sendNotificationRequest() {
  uint8_t payload[] = { 0, 1, 1, 2, 2, 5, 3, 4 };
  sendEvent(payload, 8);
}

void AcaiaScales::sendEvent(const uint8_t* payload, size_t length) {
  auto bytes = std::make_unique<uint8_t[]>(length + 1);
  bytes[0] = static_cast<uint8_t>(length + 1);

  for (size_t i = 0; i < length; ++i) {
    bytes[i + 1] = payload[i] & 0xFF;
  }

  sendMessage(AcaiaMessageType::EVENT, bytes.get(), length + 1);
}

void AcaiaScales::sendHeartbeat() {
  if (!isConnected()) {
    return;
  }

  uint32_t now = millis();
  if (now - lastHeartbeat < 2000) {
    return;
  }

  uint8_t payload1[] = { 0x02,0x00 };
  sendMessage(AcaiaMessageType::SYSTEM, payload1, 2);
  sendNotificationRequest();
  uint8_t payload2[] = { 0x00 };
  sendMessage(AcaiaMessageType::HANDSHAKE, payload2, 1);
  lastHeartbeat = now;
}

void AcaiaScales::subscribeToNotifications() {
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

void AcaiaScales::sendMessage(AcaiaMessageType msgType, const uint8_t* payload, size_t length, bool waitResponse) {
  size_t messageSize = HEADER_LENGTH + length + CHECKSUM_LENGTH;
  auto bytes = std::make_unique<uint8_t[]>(messageSize);

  // Header
  bytes[0] = static_cast<uint8_t>(AcaiaHeader::HEADER1);
  bytes[1] = static_cast<uint8_t>(AcaiaHeader::HEADER2);
  bytes[2] = static_cast<uint8_t>(msgType);

  // Payload
  memcpy(bytes.get() + HEADER_LENGTH, payload, length);

  // Checksum
  auto checksums = calculateChecksum(payload, length);
  bytes[length + 3] = (checksums.first & 0xFF);
  bytes[length + 4] = (checksums.second & 0xFF);

  commandCharacteristic->writeValue(bytes.get(), messageSize, waitResponse);
};

// Calculate the checksum for the payload of the message
static std::pair<uint8_t, uint8_t> calculateChecksum(const uint8_t* payload, size_t length) {
  uint8_t cksum1 = 0;
  uint8_t cksum2 = 0;

  for (size_t i = 0; i < length; i++) {
    if (i % 2 == 0) {
      cksum1 += payload[i];
    }
    else {
      cksum2 += payload[i];
    }
  }

  return { cksum1 & 0xFF, cksum2 & 0xFF };
}

// Discard junk data so that the first element of the buffer is the start of a message
static void cleanupJunkData(std::vector<uint8_t>& dataBuffer) {
  int messageStart = 0;

  // Find the start of the message
  while (messageStart < dataBuffer.size() - 1
    && dataBuffer[messageStart] != (uint8_t)AcaiaHeader::HEADER1
    && dataBuffer[messageStart + 1] != (uint8_t)(AcaiaHeader::HEADER2)
    ) {
    messageStart++;
  }

  // Clear everything before the start of the message
  dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageStart);
  if (messageStart == dataBuffer.size() - 1 && dataBuffer[messageStart] != (uint8_t)AcaiaHeader::HEADER1) {
    dataBuffer.clear();
  }
}

bool AcaiaScales::isUmbraModel() const {
  return RemoteScales::getDeviceName().find("UMBRA") != std::string::npos;
}
