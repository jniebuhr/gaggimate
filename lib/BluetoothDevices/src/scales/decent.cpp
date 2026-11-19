#include "decent.h"
#include "BluetoothDeviceRegistry.h"
#include <iostream>

using namespace std;

const NimBLEUUID serviceUUID("FFF0");
const NimBLEUUID readCharacteristicUUID("FFF4");
const NimBLEUUID writeCharacteristicUUID("36F5");

DecentScales::DecentScales(const DiscoveredDevice &device) : BluetoothScale(device) {}

DecentScales::~DecentScales() {}

bool DecentScales::connect() {
    if (BluetoothScale::clientIsConnected()) {
        BluetoothScale::log("Already connected\n");
        return true;
    }

    BluetoothScale::log("Connecting to %s[%s]\n", BluetoothScale::getDeviceName().c_str(),
                        BluetoothScale::getDeviceAddress().c_str());

    bool result = BluetoothScale::clientConnect();
    if (!result) {
        BluetoothScale::clientCleanup();
        return false;
    }

    if (!performConnectionHandshake()) {
        return false;
    }

    if (!subscribeToNotifications()) {
        return false;
    }

    // Turn on the OLED display after successful connection
    turnOnOLED();

    BluetoothScale::setWeight(0.f);
    return true;
}

void DecentScales::disconnect() {
    // Turn off the OLED display before disconnecting
    if (isConnected()) {
        turnOffOLED();
    }
    BluetoothScale::clientCleanup();
}

bool DecentScales::isConnected() { return BluetoothScale::clientIsConnected(); }

void DecentScales::update() {
    if (markedForReconnection) {
        BluetoothScale::log("Marked for disconnection. Will attempt to reconnect.\n");
        BluetoothScale::clientCleanup();
        if (connect()) {
            markedForReconnection = false;
        } else {
            BluetoothScale::log("Failed to reconnect\n");
            return;
        }
    } else {
        if (verifyConnected()) {
            // Send heartbeat every 5 seconds
            unsigned long now = millis();
            if (now - lastHeartbeatMillis >= 5000) {
                sendHeartbeat();
                lastHeartbeatMillis = now;
            }
        }
    }
}

void DecentScales::sendHeartbeat() {
    // Heartbeat command: 03 0A 03 FF FF 00 0A
    if (writeCharacteristic) {
        uint8_t payload[] = {0x03, 0x0A, 0x03, 0xFF, 0xFF, 0x00, 0x0A};
        writeCharacteristic->writeValue(payload, sizeof(payload), false);
        BluetoothScale::log("Heartbeat sent\n");
    }
}

void DecentScales::turnOnOLED() {
    if (writeCharacteristic) {
        // 030A 01 01 00 01 08 - weight+timer LEDs on, grams, heartbeat maintained
        uint8_t payload[] = {0x03, 0x0A, 0x01, 0x01, 0x00, 0x01, 0x08};
        writeCharacteristic->writeValue(payload, sizeof(payload), false);
        BluetoothScale::log("OLED turned on\n");
    }
}

void DecentScales::turnOffOLED() {
    if (writeCharacteristic) {
        // 030A 00 00 00 01 08 - weight+timer LEDs off, grams, heartbeat maintained
        uint8_t payload[] = {0x03, 0x0A, 0x00, 0x00, 0x00, 0x01, 0x08};
        writeCharacteristic->writeValue(payload, sizeof(payload), false);
        BluetoothScale::log("OLED turned off\n");
    }
}

bool DecentScales::tare() {
    if (!verifyConnected())
        return false;
    // 030F 000000 01 0D - tare, leaves heartbeat as set (data[5]=0x01)
    uint8_t payload[] = {0x03, 0x0F, 0x00, 0x00, 0x00, 0x01, 0x0D};
    writeCharacteristic->writeValue(payload, sizeof(payload), false);
    return true;
};

bool DecentScales::performConnectionHandshake() {
    BluetoothScale::log("Performing handshake\n");

    service = BluetoothScale::clientGetService(serviceUUID);
    if (service != nullptr) {
    } else {
        clientCleanup();
        return false;
    }
    BluetoothScale::log("Got Service\n");

    readCharacteristic = service->getCharacteristic(readCharacteristicUUID);
    writeCharacteristic = service->getCharacteristic(writeCharacteristicUUID);
    if (readCharacteristic == nullptr || writeCharacteristic == nullptr) {
        clientCleanup();
        return false;
    }
    BluetoothScale::log("Got readCharacteristic and writeCharacteristic\n");
    return true;
}

bool DecentScales::subscribeToNotifications() {
    if (readCharacteristic->canNotify()) {
        auto callback = [this](NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify) {
            readCallback(characteristic, data, length, isNotify);
        };
        if (!readCharacteristic->subscribe(true, callback, false)) {
            clientCleanup();
            return false;
        }
    } else {
        clientCleanup();
        return false;
    }
    BluetoothScale::log("Registered for notify\n");
    return true;
}

void DecentScales::readCallback(NimBLERemoteCharacteristic *pCharacteristic, uint8_t *pData, size_t length, bool isNotify) {
    if ((length == 7 || length == 10) && pData[0] == 0x03 && (pData[1] == 0xCA || pData[1] == 0xCE)) {
        handleWeightNotification(pData, length);
    } else {
        BluetoothScale::log("Wrong packet length\n");
    }
}

void DecentScales::handleWeightNotification(uint8_t *pData, size_t length) {
    int16_t weight100 = static_cast<int16_t>((uint16_t)((pData[2] << 8) | pData[3]));

    uint8_t xorByte = pData[length - 1];

    if (xorByte != 0) {
        uint8_t xorSum = pData[0];

        for (int i = 1; i < length - 1; i++) {
            xorSum ^= pData[i];
        }

        if (xorSum != xorByte) {
            BluetoothScale::log("Wrong checksum\n");
            return;
        }
    }

    BluetoothScale::setWeight(weight100 / 10.f);
    BluetoothScale::log("Weight received\n");
}

bool DecentScales::verifyConnected() {
    if (markedForReconnection) {
        return false;
    }
    if (!isConnected()) {
        markedForReconnection = true;
        return false;
    }
    return true;
}
