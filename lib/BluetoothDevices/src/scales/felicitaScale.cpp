#include "felicitaScale.h"
#include <cstring>

// Initialize UUID constants
const NimBLEUUID FelicitaScale::DATA_SERVICE_UUID("FFE0");
const NimBLEUUID FelicitaScale::DATA_CHARACTERISTIC_UUID("FFE1");

FelicitaScale::FelicitaScale(const DiscoveredDevice& device) : RemoteScales(device) {}

bool FelicitaScale::connect() {
    if (isConnected()) {
        log("Already connected.\n");
        return true;
    }

    if (!clientConnect()) {
        clientCleanup();
        return false;
    }

    if (!performConnectionHandshake()) {
        clientCleanup();
        return false;
    }
    setWeight(0.f);
    return true;
}

void FelicitaScale::disconnect() {
    clientCleanup();
}

bool FelicitaScale::isConnected() {
    return clientIsConnected();
}

void FelicitaScale::update() {
    if (markedForReconnection) {
        log("Reconnecting...\n");
        clientCleanup();
        connect();
        markedForReconnection = false;
    } else {
      verifyConnected();
    }
}

bool FelicitaScale::tare() {
    if (!verifyConnected()) return false;
    log("Tare command sent.\n");
    uint8_t tareCommand[] = {CMD_TARE};
    dataCharacteristic->writeValue(tareCommand, sizeof(tareCommand), false);
    return true;
}

bool FelicitaScale::performConnectionHandshake() {
    log("Performing handshake...\n");

    service = clientGetService(DATA_SERVICE_UUID);
    if (!service) {
        log("Service not found.\n");
        return false;
    }

    dataCharacteristic = service->getCharacteristic(DATA_CHARACTERISTIC_UUID);
    if (!dataCharacteristic) {
        log("Characteristic not found.\n");
        return false;
    }

    if (dataCharacteristic->canNotify()) {
        dataCharacteristic->subscribe(true, [this](NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
            notifyCallback(characteristic, data, length, isNotify);
        });
    } else {
        log("Notifications not supported.\n");
        return false;
    }
    
    return true;
}
bool FelicitaScale::verifyConnected() {
  if (markedForReconnection) {
    return false;
  }
  if (!isConnected()) {
    markedForReconnection = true;
    return false;
  }
  return true;
}

void FelicitaScale::notifyCallback(NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
    log("Notification received.\n");
    if (length < 18) {
        log("Malformed data.\n");
        return;
    }
    parseStatusUpdate(data, length);
}

void FelicitaScale::parseStatusUpdate(const uint8_t* data, size_t length) {
    float weight = static_cast<float>(parseWeight(data)) / 100.0f;
    setWeight(weight);
    // log("Weight updated: %.1f g\n", weight);
}

int32_t FelicitaScale::parseWeight(const uint8_t* data) {
    
    bool isNegative = (data[2] == 0x2D);
    
    if ((data[3] | data[4] | data[5] | data[6] | data[7] | data[8]) < '0' || 
        (data[3] & data[4] & data[5] & data[6] & data[7] & data[8]) > '9') {
        log("Invalid digit in weight data\n");
        return 0;
    }

    // Direct digit expansion
    return (isNegative ? -1 : 1) * (
        (data[3] - '0') * 100000 +
        (data[4] - '0') * 10000 +
        (data[5] - '0') * 1000 +
        (data[6] - '0') * 100 +
        (data[7] - '0') * 10 +
        (data[8] - '0')
    );
}

uint8_t FelicitaScale::calculateChecksum(const uint8_t* data, size_t length) {
    uint8_t checksum = 0;
    for (size_t i = 0; i < length - 1; ++i) {
        checksum += data[i];
    }
    return checksum;
}
