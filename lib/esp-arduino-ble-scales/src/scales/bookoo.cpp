#include "bookoo.h"
#include "remote_scales_plugin_registry.h"

/*
Handle protocol according to the spec found at
https://github.com/BooKooCode/OpenSource/blob/main/bookoo_mini_scale/protocols.md
*/
const size_t RECEIVE_PROTOCOL_LENGTH = 20;

const NimBLEUUID serviceUUID("0FFE");
const NimBLEUUID weightCharacteristicUUID("FF11");
const NimBLEUUID commandCharacteristicUUID("FF12");

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
BookooScales::BookooScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool BookooScales::connect() {
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

void BookooScales::disconnect() {
  RemoteScales::clientCleanup();
}

bool BookooScales::isConnected() {
  return RemoteScales::clientIsConnected();
}

void BookooScales::update() {
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

bool BookooScales::tare() {
  if (!isConnected()) return false;
  RemoteScales::log("Tare sent");
  uint8_t payload[6] = { 0x03, 0x0a, 0x01, 0x00, 0x00, 0x08 };
  sendMessage(BookooMessageType::SYSTEM, payload, sizeof(payload));

  return true;
};

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/
void BookooScales::notifyCallback(
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

/*
Handle protocol according to the spec found at
https://github.com/BooKooCode/OpenSource/blob/main/bookoo_mini_scale/protocols.md#receiving-weight
*/
bool BookooScales::decodeAndHandleNotification() {
  // Minimum message length check (20 bytes based on protocol definition)
  if (dataBuffer.size() < RECEIVE_PROTOCOL_LENGTH) {
    return false;
  }

  BookooMessageType messageType = static_cast<BookooMessageType>(dataBuffer[1]);
  uint8_t productNumber = dataBuffer[0];

  size_t messageLength = dataBuffer.size();

  // Handle different message types
  if (productNumber == 0x03 && messageType == BookooMessageType::WEIGHT) {
    // Checksum validation: XOR of Header1 ^ Header2 ^ Data0 ^ Data1 ^ ... ^ DataN should equal DataSUM
    uint8_t checksum = dataBuffer[0];
    for (size_t i = 1; i < messageLength - 1; i++) {
      checksum ^= dataBuffer[i];
    }

    // The last byte in the message is DataSUM
    uint8_t dataSUM = dataBuffer[messageLength - 1];

    if (checksum != dataSUM) {
      RemoteScales::log("Checksum failed: calc[%02X] but actual[%02X]. Discarding.\n",
        checksum, dataSUM);
      dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageLength);
      return false;
    }

    float weight = (dataBuffer[7] << 16) | (dataBuffer[8] << 8) | dataBuffer[9];

    if (dataBuffer[6] == 45) { // Check if the value is negative
      weight = -weight;
    }

    RemoteScales::setWeight(weight * 0.01f); // Convert to floating point
  }
  else if (productNumber == 0x03 && messageType == BookooMessageType::SYSTEM) {
    BookooScales::tare();
  }
  else {
    RemoteScales::log("Unknown message type %02X: %s\n", messageType, RemoteScales::byteArrayToHexString(dataBuffer.data(), messageLength).c_str());
  }

  // Remove processed message from the buffer
  dataBuffer.erase(dataBuffer.begin(), dataBuffer.end());

  // Return whether there's more data to process
  return dataBuffer.size() < RECEIVE_PROTOCOL_LENGTH;
}

bool BookooScales::performConnectionHandshake() {
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

  // Subscribe
  NimBLERemoteDescriptor* notifyDescriptor = weightCharacteristic->getDescriptor(NimBLEUUID((uint16_t)0x2902));
  RemoteScales::log("Got notifyDescriptor\n");
  if (notifyDescriptor != nullptr) {
    uint8_t value[2] = { 0x00, 0x01 };
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

void BookooScales::sendNotificationRequest() {
  uint8_t payload[] = { 0, 0, 0, 0, 0, 0 };
  sendEvent(payload, 6);
  RemoteScales::log("Sent event.\n");
}

void BookooScales::sendEvent(const uint8_t* payload, size_t length) {
  auto bytes = std::make_unique<uint8_t[]>(length + 1);
  bytes[0] = static_cast<uint8_t>(length + 1);

  for (size_t i = 0; i < length; ++i) {
    bytes[i + 1] = payload[i] & 0xFF;
  }

  sendMessage(BookooMessageType::SYSTEM, bytes.get(), length + 1);
}

void BookooScales::sendHeartbeat() {
  if (!isConnected()) {
    return;
  }

  uint32_t now = millis();
  if (now - lastHeartbeat < 2000) {
    return;
  }

  uint8_t payload1[] = { 0x02,0x00 };
  sendMessage(BookooMessageType::SYSTEM, payload1, 2);
  sendNotificationRequest();
  uint8_t payload2[] = { 0x00 };
  sendMessage(BookooMessageType::SYSTEM, payload2, 1);
  lastHeartbeat = now;
}

void BookooScales::subscribeToNotifications() {
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

void BookooScales::sendMessage(BookooMessageType msgType, const uint8_t* payload, size_t length, bool waitResponse) {

  auto bytes = std::make_unique<uint8_t[]>(length);

  memcpy(bytes.get(), payload, length);

  // Checksum Calculation (XOR of all bytes except checksum byte)
  uint8_t checksum = bytes[0];
  for (size_t i = 1; i < length - 1; i++) {
    checksum ^= bytes[i];
  }
  bytes[length - 1] = checksum;

  commandCharacteristic->writeValue(bytes.get(), length, waitResponse);
}
