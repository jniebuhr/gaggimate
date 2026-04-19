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

  // Disable the scale-side flow-smoothing EMA so consumers see raw per-sample
  // flow in getFlowRate(). Firmware-side code (ShotHistoryPlugin,
  // VolumetricRateCalculator) is free to filter if needed; running both EMAs
  // compounds lag without adding accuracy.
  disableScaleSmoothing();

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
  RemoteScales::log("Tare+StartTimer sent (cmd 0x07)");
  // Use command 0x07 (Tare + Start Timer), officially recommended by Bookoo over
  // the plain 0x01 tare: it atomically resets the weight AND marks the scale as
  // "shot is in progress", which prevents the scale from auto-sleeping or drifting
  // during a long brew. The firmware does not currently consume the scale's timer
  // output, so this is behaviorally equivalent to 0x01 for our purposes, but is
  // future-proof if we ever want to cross-check shot timing against the scale.
  // sendMessage() computes and writes the final checksum byte.
  uint8_t payload[6] = { 0x03, 0x0A, 0x07, 0x00, 0x00, 0x00 };
  sendMessage(payload, sizeof(payload));

  return true;
};

void BookooScales::disableScaleSmoothing() {
  if (!isConnected()) return;
  RemoteScales::log("Flow-smoothing OFF (cmd 0x08 0x00)");
  // Command 0x08 disables the scale's own EMA on its reported flow rate, so
  // getFlowRate() returns raw per-sample flow rather than scale-side filtered
  // output. Firmware consumers (ShotHistoryPlugin, VolumetricRateCalculator)
  // can then apply their own filtering or use the raw signal directly --
  // avoiding a double-EMA pipeline that adds lag with no accuracy benefit.
  uint8_t payload[6] = { 0x03, 0x0A, 0x08, 0x00, 0x00, 0x00 };
  sendMessage(payload, sizeof(payload));
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

  size_t messageLength = RECEIVE_PROTOCOL_LENGTH;

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

    // Parse the full 20-byte weight notification per the Bookoo protocol spec:
    // https://github.com/BooKooCode/OpenSource/blob/main/bookoo_ultra_scale/protocols.md
    //
    // Byte layout (0-indexed):
    //   [0]    product id (0x03)
    //   [1]    message type (0x0B = weight)
    //   [2-4]  scale-internal timestamp (ms, 3 bytes unsigned)
    //   [5]    weight unit (0x01 = ounce, 0x02 = gram)
    //   [6]    weight sign ('+' = 0x2B, '-' = 0x2D)
    //   [7-9]  weight * 100 in grams (3 bytes unsigned)
    //   [10]   flow sign
    //   [11-12] flow rate * 100 in g/s (2 bytes unsigned)
    //   [13]   battery percentage (0-100)
    //   [14-15] standby timer (minutes, 2 bytes unsigned) -- not surfaced yet
    //   [16]   buzzer gear                                 -- not surfaced yet
    //   [17]   flow-smoothing switch (0/1)                 -- not surfaced yet
    //   [18]   Ultra: auto-mode stop condition (0/1); Mini: reserved
    //   [19]   checksum

    // Scale timer (bytes 2-4, 3 bytes big-endian unsigned, milliseconds).
    const uint32_t timerMs = (static_cast<uint32_t>(dataBuffer[2]) << 16) |
                             (static_cast<uint32_t>(dataBuffer[3]) << 8)  |
                              static_cast<uint32_t>(dataBuffer[4]);
    RemoteScales::setScaleTimerMs(timerMs);

    // Weight unit (byte 5).
    switch (dataBuffer[5]) {
      case 0x01: RemoteScales::setWeightUnit(ScaleWeightUnit::OUNCE); break;
      case 0x02: RemoteScales::setWeightUnit(ScaleWeightUnit::GRAM); break;
      default:   RemoteScales::setWeightUnit(ScaleWeightUnit::UNKNOWN); break;
    }

    // Weight (sign byte 6 + value bytes 7-9, 0.01g resolution).
    int32_t rawWeight = (static_cast<int32_t>(dataBuffer[7]) << 16) |
                        (static_cast<int32_t>(dataBuffer[8]) << 8)  |
                         static_cast<int32_t>(dataBuffer[9]);
    if (dataBuffer[6] == 0x2D) { // '-'
      rawWeight = -rawWeight;
    }
    RemoteScales::setWeight(rawWeight * 0.01f);

    // Flow rate (sign byte 10 + value bytes 11-12, 0.01 g/s resolution).
    int32_t rawFlow = (static_cast<int32_t>(dataBuffer[11]) << 8) |
                       static_cast<int32_t>(dataBuffer[12]);
    if (dataBuffer[10] == 0x2D) { // '-'
      rawFlow = -rawFlow;
    }
    RemoteScales::setFlowRate(rawFlow * 0.01f);

    // Battery percentage (byte 13).
    RemoteScales::setBatteryLevel(dataBuffer[13]);

    // Auto-mode stop condition (byte 18) -- only meaningful on Ultra scales
    // where hasAutoModeStopCondition() returns true. We still store it so an
    // Ultra-aware subclass (or a future firmware-side model check) can read it.
    RemoteScales::setAutoModeStopCondition(dataBuffer[18]);
  }
  else if (productNumber == 0x03 && messageType == BookooMessageType::SYSTEM) {
    RemoteScales::log("Inbound SYSTEM message ignored: %s\n", RemoteScales::byteArrayToHexString(dataBuffer.data(), messageLength).c_str());
  }
  else {
    RemoteScales::log("Unknown message type %02X: %s\n", messageType, RemoteScales::byteArrayToHexString(dataBuffer.data(), messageLength).c_str());
  }

  // Remove processed message from the buffer
  dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageLength);

  // Return whether there's more data to process
  return dataBuffer.size() >= RECEIVE_PROTOCOL_LENGTH;
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

  sendMessage(bytes.get(), length + 1);
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
  sendMessage(payload1, 2);
  sendNotificationRequest();
  uint8_t payload2[] = { 0x00 };
  sendMessage(payload2, 1);
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

// NOTE: the last byte of `payload` is overwritten with the XOR checksum — callers must reserve it.
void BookooScales::sendMessage(const uint8_t* payload, size_t length, bool waitResponse) {

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
