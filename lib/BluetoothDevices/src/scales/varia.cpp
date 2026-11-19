#include "varia.h"
#include "remote_scales_plugin_registry.h"

const NimBLEUUID serviceUUID("FFF0");
const NimBLEUUID weightCharacteristicUUID("FFF1");
const NimBLEUUID commandCharacteristicUUID("FFF2");

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/

VariaScales::VariaScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool VariaScales::connect() {
  if (clientIsConnected()) {
    log("Already connected\n");
    return true;
  }

  if (!clientConnect()) {
    clientCleanup();
    return false;
  }

  if (!fetchServices()) {
    return false;
  }

  setWeight(0.f);

  subscribeToNotifications();

  return true;
}

void VariaScales::disconnect() {
  clientCleanup();
}

bool VariaScales::isConnected() {
  return clientIsConnected();
}

bool VariaScales::tare() {
  if (!isConnected()) return false;
  log("Sending tare command\n");
  uint8_t cmd = static_cast<uint8_t>(VariaMessageType::TARE);
  uint8_t payload[] = { cmd, 0x01, 0x01 };
  sendMessage(VariaMessageType::SYSTEM, payload, sizeof(payload));
  return true;
};

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/

bool VariaScales::fetchServices() {
  service = clientGetService(serviceUUID);
  if (service != nullptr) {
    log("Got Service\n");
  }
  else {
    clientCleanup();
    return false;
  }

  weightCharacteristic = service->getCharacteristic(weightCharacteristicUUID);
  commandCharacteristic = service->getCharacteristic(commandCharacteristicUUID);
  if (weightCharacteristic != nullptr && commandCharacteristic != nullptr) {
    log("Got Weight and Command Characteristics\n");
  }
  else {
    clientCleanup();
    return false;
  }

  return true;
}

void VariaScales::subscribeToNotifications() {
  auto callback = [this](NimBLERemoteCharacteristic* pRemoteCharacteristic, uint8_t* data, size_t length, bool isNotify) {
    notifyCallback(pRemoteCharacteristic, data, length, isNotify);
  };

  if (weightCharacteristic->canNotify()) {
    log("Registering callback for weight characteristic\n");
    weightCharacteristic->subscribe(true, callback);
  }
}

void VariaScales::sendMessage(VariaMessageType msgType, const uint8_t* payload, size_t payloadLen, bool waitResponse) {
  uint8_t checksum = payload[0];
  for (size_t i = 1; i < payloadLen; i++) {
    checksum ^= payload[i];
  }

  const size_t msgLen = 1 + payloadLen + 1;

  auto bytes = std::make_unique<uint8_t[]>(msgLen);

  bytes[0] = static_cast<uint8_t>(msgType);
  memcpy(bytes.get()+1, payload, payloadLen);
  bytes[msgLen - 1] = checksum;

  commandCharacteristic->writeValue(bytes.get(), msgLen, waitResponse);
}

void VariaScales::notifyCallback(NimBLERemoteCharacteristic* pRemoteCharacteristic, uint8_t* data, size_t length, bool isNotify) {
  if(length < 2) {
    log("notifyCallback: message too short, expected at least 2 bytes, got: %s\n", byteArrayToHexString(data, length).c_str());
    return;
  }
  if(data[0] != static_cast<uint8_t>(VariaMessageType::SYSTEM)) {
    log("notifyCallback: Only system type messages are supported: %s\n", byteArrayToHexString(data, length).c_str());
    return;
  }

  while(length > 0) {
    VariaMessageType messageType = static_cast<VariaMessageType>(data[1]);

    switch(messageType) {
    case VariaMessageType::WEIGHT:
    {
      // [FA 01] 03 10 02 CD {DD}
      const size_t msgLen = 7;
      if(! validNotifiedMessage(data, length, msgLen)) {
        log("Invalid message of type %02x: %s\n", messageType, byteArrayToHexString(data, length).c_str());
        return;
      }
      int sign = (data[3] & 0x10) == 0 ? 1 : -1;
      int value = ((data[3] & 0x0f) << 16) + (data[4] << 8) + data[5];
      setWeight(sign * value * 0.01f);
      data += msgLen;
      length -= msgLen;
      break;
    }
    case VariaMessageType::TIMER:
    {
      // [FA 87] 02 00 02 {87}
      const size_t msgLen = 6;
      if(!validNotifiedMessage(data, length, msgLen)) {
        log("Invalid message of type %02x: %s\n", messageType, byteArrayToHexString(data, length).c_str());
        return;
      }
      timerSeconds = (data[3] << 8) + data[4];
      data += msgLen;
      length -= msgLen;
      break;
    }
    case VariaMessageType::TIMER_START:
    case VariaMessageType::TIMER_STOP:
    case VariaMessageType::TIMER_RESET:
    {
      // [FA 88] 01 01 {88}
      // [FA 89] 01 02 {8A}
      // [FA 8A] 01 03 {88}
      const size_t msgLen = 5;
      if(!validNotifiedMessage(data, length, msgLen)) {
        log("Invalid message of type %02x: %s\n", messageType, byteArrayToHexString(data, length).c_str());
        return;
      }
      log("Timer event: %02x\n", data[1]);
      data += msgLen;
      length -= msgLen;
      break;
    }
    case VariaMessageType::BATTERY:
    {
      // [FA 85] 01 4B {CF}
      const size_t msgLen = 5;
      if(!validNotifiedMessage(data, length, msgLen)) {
        log("Invalid message of type %02x: %s\n", messageType, byteArrayToHexString(data, length).c_str());
        return;
      }
      batteryPercent = data[3];
      data += msgLen;
      length -= msgLen;
      break;
    }
    default:
      // log("Unknown message type %02X: %s\n", messageType, byteArrayToHexString(data, length).c_str());
      return;
    }
  }
}

bool VariaScales::validNotifiedMessage(uint8_t* data, size_t length, size_t expectedLength) {
  if(length < expectedLength) {
    return false;
  }

  const size_t xorFirst = 1;
  const size_t xorLast = expectedLength - 2;
  const size_t xorExpected = expectedLength - 1;

  uint8_t sum = data[xorFirst];
  for(size_t idx = xorFirst+1; idx <= xorLast; idx++) {
    sum ^= data[idx];
  }
  return sum == data[xorExpected];
}