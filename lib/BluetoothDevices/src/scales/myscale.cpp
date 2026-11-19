#include "myscale.h"
#include <cstring>

// Initialize UUID constants
const NimBLEUUID myscale::DATA_SERVICE_UUID("0000FFB0-0000-1000-8000-00805F9B34FB");
const NimBLEUUID myscale::DATA_CHARACTERISTIC_UUID("0000FFB2-0000-1000-8000-00805F9B34FB");
const NimBLEUUID myscale::WRITE_CHARACTERISTIC_UUID("0000FFB1-0000-1000-8000-00805F9B34FB");

myscale::myscale(const DiscoveredDevice& device) : RemoteScales(device) {}

bool myscale::connect() {
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

void myscale::disconnect() {
    clientCleanup();
}

bool myscale::isConnected() {
    return clientIsConnected();
}

void myscale::update() {
    if (markedForReconnection) {
        log("Reconnecting...\n");
        clientCleanup();
        connect();
        markedForReconnection = false;
    } else {
      verifyConnected();
    }
}

bool myscale::tare() {
    if (!isConnected()) return false;

    // Hex value to send on tare
    uint8_t tare_value[] = {
        0xAC, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0xD2, 0xD2
    };

    auto writeChar = writeCharacteristic;
    if (!writeChar) {
        log("Write characteristic not found.\n");
        return false;
    }

    writeChar->writeValue(tare_value, sizeof(tare_value), false); // write without response
    log("Tare command sent.\n");
    return true;
}

bool myscale::performConnectionHandshake() {
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
        auto cccd = dataCharacteristic->getDescriptor(NimBLEUUID((uint16_t)0x2902));
        if (cccd) {
            uint8_t notifyOn[] = {0x01, 0x00};
            cccd->writeValue(notifyOn, 2, true); // enable notifications
        }
        dataCharacteristic->subscribe(true, [this](NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
            notifyCallback(characteristic, data, length, isNotify);
        });
    } else {
        log("Notifications not supported.\n");
        return false;
    }

    // Cache write characteristic once to avoid blocking discovery during tare
    writeCharacteristic = service->getCharacteristic(WRITE_CHARACTERISTIC_UUID);
    if (!writeCharacteristic) {
        log("Write characteristic not found during handshake.\n");
        return false;
    }
    
    return true;
}
bool myscale::verifyConnected() {
  if (markedForReconnection) {
    return false;
  }
  if (!isConnected()) {
    markedForReconnection = true;
    return false;
  }
  return true;
}

void myscale::notifyCallback(NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
    if (length < 15) {
        log("Malformed data.\n");
        return;
    }
    parseStatusUpdate(data, length);
}



void myscale::parseStatusUpdate(const uint8_t* data, size_t length) {
    int32_t raw = parseWeight(data);
    float weight = static_cast<float>(raw) / 1000.0f; 
    setWeight(weight);
}



int32_t myscale::parseWeight(const uint8_t* data) {

    bool isNegative = ((data[2] >> 4) == 0x8 || (data[2] >> 4) == 0xC);

    uint32_t raw =
        ( (uint32_t)(data[3] & 0x0F) << 24 ) |
        ( (uint32_t)data[4] << 16 ) |
        ( (uint32_t)data[5] <<  8 ) |
        ( (uint32_t)data[6]       );

    return isNegative ? -static_cast<int32_t>(raw) : static_cast<int32_t>(raw);
}

uint8_t myscale::calculateChecksum(const uint8_t* data, size_t length) {
    uint8_t checksum = 0;
    for (size_t i = 0; i < length - 1; ++i) {
        checksum += data[i];
    }
    return checksum;
}
