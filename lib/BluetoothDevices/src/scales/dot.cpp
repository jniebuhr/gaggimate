#include "dot.h"
#include "remote_scales_plugin_registry.h"

// Timemore Dot protocol.
//
// Every frame, in both directions, big-endian:
//   A5 5A | class | type | payload length (2) | payload | CRC (2)
// The CRC is CRC-16/MODBUS (init 0xFFFF, reflected poly 0xA001) over all bytes before it.
//
// Written to FFF2:
//   class 0x03 = control
//     0x0D            tare
//     0x02 [1|2|3]    timer start | stop | reset
//     0x06 [unit]     weight unit, 0 = gram
//     0x08 [01 00]    standard weighing mode
//     0x0B            power off
//   class 0x02 = query, the type names the setting to read back (0x02 timer, 0x05 battery, 0x06 unit, 0x08 mode, ...)
//     and the scale answers each one with an extra report. This driver sends none: weight and battery are
//     streamed unsolicited, and every query only adds traffic. Earlier versions sent query 0x04 with each tare,
//     mistaking it for the tare command, and the real tare (0x03 0x0D) as a "status poll".
// Notified on FFF1, class 0x01 (unsolicited) or 0x02 (answer to a query):
//   0x01  weight (signed 32 bit, 0.1 g), flow rate (signed 16 bit, 0.1 g/s), timer, overload flag
//   0x05  battery, percentage in the second payload byte
//
// The Dot only streams once the link is encrypted, so the central has to start LE security itself.

namespace {

const NimBLEUUID SERVICE_UUID("FFF0");
const NimBLEUUID WEIGHT_UUID("FFF1");
const NimBLEUUID COMMAND_UUID("FFF2");

constexpr uint8_t MAGIC[2] = { 0xA5, 0x5A };
constexpr size_t HEADER_LENGTH = 6;   // magic, class, type, length
constexpr size_t TRAILER_LENGTH = 2;  // CRC
constexpr size_t MAX_PAYLOAD_LENGTH = 64;  // real frames carry <= 9 bytes; anything larger is a desync

constexpr uint8_t CLASS_COMMAND = 0x03;
constexpr uint8_t CLASS_REPORT_A = 0x01;
constexpr uint8_t CLASS_REPORT_B = 0x02;

constexpr uint8_t CMD_TIMER = 0x02;
constexpr uint8_t CMD_UNIT = 0x06;
constexpr uint8_t CMD_MODE = 0x08;
constexpr uint8_t CMD_POWER_OFF = 0x0B;
constexpr uint8_t CMD_TARE = 0x0D;

constexpr uint8_t REPORT_WEIGHT = 0x01;
constexpr uint8_t REPORT_BATTERY = 0x05;

constexpr uint8_t TIMER_START = 0x01;
constexpr uint8_t TIMER_STOP = 0x02;
constexpr uint8_t TIMER_RESET = 0x03;

constexpr int CONNECT_ATTEMPTS = 3;
constexpr uint32_t CONNECT_RETRY_DELAY_MS = 500;
constexpr uint32_t SETTLE_AFTER_SUBSCRIBE_MS = 500;
constexpr uint32_t SETTLE_BETWEEN_COMMANDS_MS = 200;

uint16_t crc16Modbus(const uint8_t* data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (int bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? static_cast<uint16_t>((crc >> 1) ^ 0xA001) : static_cast<uint16_t>(crc >> 1);
    }
  }
  return crc;
}

}  // namespace

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
TimemoreDotScales::TimemoreDotScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool TimemoreDotScales::connect() {
  if (RemoteScales::clientIsConnected()) {
    RemoteScales::log("Already connected\n");
    return true;
  }
  RemoteScales::log("Connecting to %s[%s]\n", RemoteScales::getDeviceName().c_str(), RemoteScales::getDeviceAddress().c_str());

  if (!openLink() || !secureLink() || !discoverCharacteristics() || !subscribe()) {
    RemoteScales::clientCleanup();
    return false;
  }
  configure();
  RemoteScales::setWeight(0.f);
  return true;
}

void TimemoreDotScales::disconnect() {
  RemoteScales::clientCleanup();
}

bool TimemoreDotScales::isConnected() {
  return RemoteScales::clientIsConnected();
}

// The Dot needs no keep-alive and a lost link is left to the application to re-establish.
void TimemoreDotScales::update() {}

bool TimemoreDotScales::tare() {
  return sendCommand(CMD_TARE);
}

void TimemoreDotScales::shutdown() {
  sendCommand(CMD_POWER_OFF);
}

void TimemoreDotScales::startTimer() {
  sendCommand(CMD_TIMER, &TIMER_START, 1);
}

void TimemoreDotScales::stopTimer() {
  sendCommand(CMD_TIMER, &TIMER_STOP, 1);
}

void TimemoreDotScales::resetTimer() {
  sendCommand(CMD_TIMER, &TIMER_RESET, 1);
}

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/

// After a previous session the Dot can keep its end of the old link open for a moment, so the first attempt may fail.
bool TimemoreDotScales::openLink() {
  for (int attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
    if (RemoteScales::clientConnect()) return true;
    RemoteScales::clientCleanup();
    RemoteScales::log("Connect attempt %d of %d failed\n", attempt, CONNECT_ATTEMPTS);
    if (attempt < CONNECT_ATTEMPTS) delay(CONNECT_RETRY_DELAY_MS);
  }
  return false;
}

bool TimemoreDotScales::secureLink() {
  // RemoteScales keeps its client private, so look it up by the peer address.
  NimBLEClient* nimbleClient = NimBLEDevice::getClientByPeerAddress(NimBLEAddress(RemoteScales::getDeviceAddress()));
  NimBLEDevice::setSecurityAuth(true, false, true);
  if (nimbleClient == nullptr || !nimbleClient->secureConnection()) {
    RemoteScales::log("Encrypting the link failed\n");
    return false;
  }
  return true;
}

bool TimemoreDotScales::discoverCharacteristics() {
  service = RemoteScales::clientGetService(SERVICE_UUID);
  if (service == nullptr) {
    RemoteScales::log("Service FFF0 not found\n");
    return false;
  }
  weightCharacteristic = service->getCharacteristic(WEIGHT_UUID);
  commandCharacteristic = service->getCharacteristic(COMMAND_UUID);
  if (weightCharacteristic == nullptr || commandCharacteristic == nullptr) {
    RemoteScales::log("Characteristics FFF1/FFF2 not found\n");
    return false;
  }
  return true;
}

bool TimemoreDotScales::subscribe() {
  rxBuffer.clear();
  auto callback = [this](NimBLERemoteCharacteristic*, uint8_t* data, size_t length, bool) { onNotify(data, length); };
  // Some stacks mis-report the property bits, so try notifications first and indications second instead of checking them.
  if (weightCharacteristic->subscribe(true, callback) || weightCharacteristic->subscribe(false, callback)) return true;
  RemoteScales::log("Subscribing to FFF1 failed\n");
  return false;
}

// Put the scale into a known state: grams, plain weighing mode. Deliberately no tare here.
void TimemoreDotScales::configure() {
  delay(SETTLE_AFTER_SUBSCRIBE_MS);
  const uint8_t gram = 0x00;
  sendCommand(CMD_UNIT, &gram, 1);
  delay(SETTLE_BETWEEN_COMMANDS_MS);
  const uint8_t standardMode[] = { 0x01, 0x00 };
  sendCommand(CMD_MODE, standardMode, sizeof(standardMode));
}

bool TimemoreDotScales::sendCommand(uint8_t type, const uint8_t* payload, size_t length) {
  if (!isConnected() || commandCharacteristic == nullptr || length > MAX_PAYLOAD_LENGTH) return false;

  uint8_t frame[HEADER_LENGTH + MAX_PAYLOAD_LENGTH + TRAILER_LENGTH];
  frame[0] = MAGIC[0];
  frame[1] = MAGIC[1];
  frame[2] = CLASS_COMMAND;
  frame[3] = type;
  frame[4] = static_cast<uint8_t>(length >> 8);
  frame[5] = static_cast<uint8_t>(length);
  for (size_t i = 0; i < length; i++) frame[HEADER_LENGTH + i] = payload[i];
  const size_t crcOffset = HEADER_LENGTH + length;
  const uint16_t crc = crc16Modbus(frame, crcOffset);
  frame[crcOffset] = static_cast<uint8_t>(crc >> 8);
  frame[crcOffset + 1] = static_cast<uint8_t>(crc);

  if (!commandCharacteristic->writeValue(frame, crcOffset + TRAILER_LENGTH, false)) {
    RemoteScales::log("Writing command 0x%02X failed\n", type);
    return false;
  }
  return true;
}

// Notifications are a byte stream: a frame may be split across packets or share one with the next frame.
void TimemoreDotScales::onNotify(const uint8_t* data, size_t length) {
  rxBuffer.insert(rxBuffer.end(), data, data + length);
  while (consumeFrame()) {
  }
}

// Takes at most one frame (or a run of garbage) off the front of the buffer; false once more bytes are needed.
bool TimemoreDotScales::consumeFrame() {
  auto start = rxBuffer.begin();
  while (start != rxBuffer.end() && *start != MAGIC[0]) ++start;
  rxBuffer.erase(rxBuffer.begin(), start);
  if (rxBuffer.size() < HEADER_LENGTH + TRAILER_LENGTH) return false;

  const size_t payloadLength = (static_cast<size_t>(rxBuffer[4]) << 8) | rxBuffer[5];
  if (rxBuffer[1] != MAGIC[1] || payloadLength > MAX_PAYLOAD_LENGTH) {
    rxBuffer.erase(rxBuffer.begin());  // not a frame start after all, resync on the next magic byte
    return true;
  }
  const size_t frameLength = HEADER_LENGTH + payloadLength + TRAILER_LENGTH;
  if (rxBuffer.size() < frameLength) return false;

  // The checksum of inbound frames has not been confirmed on hardware yet, so a mismatch is reported once, not enforced.
  const uint16_t expected = crc16Modbus(rxBuffer.data(), HEADER_LENGTH + payloadLength);
  const uint16_t received = static_cast<uint16_t>((rxBuffer[frameLength - 2] << 8) | rxBuffer[frameLength - 1]);
  if (expected != received && !crcMismatchLogged) {
    crcMismatchLogged = true;
    RemoteScales::log("Inbound CRC differs (got %04X, computed %04X)\n", received, expected);
  }

  handleFrame(rxBuffer[2], rxBuffer[3], rxBuffer.data() + HEADER_LENGTH, payloadLength);
  rxBuffer.erase(rxBuffer.begin(), rxBuffer.begin() + frameLength);
  return !rxBuffer.empty();
}

void TimemoreDotScales::handleFrame(uint8_t frameClass, uint8_t type, const uint8_t* payload, size_t length) {
  if (frameClass != CLASS_REPORT_A && frameClass != CLASS_REPORT_B) return;

  if (type == REPORT_WEIGHT && length >= 8) {
    const uint32_t raw = (static_cast<uint32_t>(payload[0]) << 24) | (static_cast<uint32_t>(payload[1]) << 16) |
                         (static_cast<uint32_t>(payload[2]) << 8) | static_cast<uint32_t>(payload[3]);
    RemoteScales::setWeight(static_cast<int32_t>(raw) / 10.0f);
    // Unit is forced to gram on connect, so flow is in 0.1 g/s.
    const auto flow = static_cast<int16_t>((payload[4] << 8) | payload[5]);
    RemoteScales::setFlowRate(flow / 10.0f);
  } else if (type == REPORT_BATTERY && length >= 2) {
    RemoteScales::setBatteryLevel(payload[1]);
  }
}
