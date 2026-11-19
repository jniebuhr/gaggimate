#include "weighmybru.h"
#include "BluetoothDeviceRegistry.h"

/*
Handle protocol for WeighMyBru scale
*/
const size_t RECEIVE_PROTOCOL_LENGTH = 20;

const NimBLEUUID serviceUUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
const NimBLEUUID weightCharacteristicUUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E");
const NimBLEUUID commandCharacteristicUUID("6E400003-B5A3-F393-E0A9-E50E24DCCA9E");

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
WeighMyBrewScales::WeighMyBrewScales(const DiscoveredDevice &device) : BluetoothScale(device) {}

bool WeighMyBrewScales::connect() {
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
    subscribeToNotifications();
    BluetoothScale::setWeight(0.f);
    return true;
}

void WeighMyBrewScales::disconnect() { BluetoothScale::clientCleanup(); }

bool WeighMyBrewScales::isConnected() { return BluetoothScale::clientIsConnected(); }

void WeighMyBrewScales::update() {
    if (markedForReconnection) {
        BluetoothScale::log("Marked for disconnection. Will attempt to reconnect.\n");
        BluetoothScale::clientCleanup();
        connect();
        markedForReconnection = false;
    } else {
        sendHeartbeat();
        BluetoothScale::log("Heartbeat sent.\n");
    }
}

bool WeighMyBrewScales::tare() {
    if (!isConnected())
        return false;
    BluetoothScale::log("Tare sent");
    uint8_t payload[6] = {0x03, 0x0a, 0x01, 0x01, 0x00, 0x08};
    sendMessage(WeighMyBrewMessageType::SYSTEM, payload, sizeof(payload));

    return true;
};

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/
void WeighMyBrewScales::notifyCallback(NimBLERemoteCharacteristic *pBLERemoteCharacteristic, uint8_t *pData, size_t length,
                                       bool isNotify) {
    dataBuffer.insert(dataBuffer.end(), pData, pData + length);
    bool result = true;
    while (result) {
        result = decodeAndHandleNotification();
    }
}

/*
Handle WeighMyBru protocol
*/
bool WeighMyBrewScales::decodeAndHandleNotification() {
    // Minimum message length check (20 bytes based on protocol definition)
    if (dataBuffer.size() < RECEIVE_PROTOCOL_LENGTH) {
        return false;
    }

    WeighMyBrewMessageType messageType = static_cast<WeighMyBrewMessageType>(dataBuffer[1]);
    uint8_t productNumber = dataBuffer[0];

    const size_t messageLength = RECEIVE_PROTOCOL_LENGTH;

    // Handle different message types
    if (productNumber == 0x03 && messageType == WeighMyBrewMessageType::WEIGHT) {
        // Checksum validation: XOR of Header1 ^ Header2 ^ Data0 ^ Data1 ^ ... ^ DataN should equal DataSUM
        uint8_t checksum = dataBuffer[0];
        for (size_t i = 1; i < messageLength - 1; i++) {
            checksum ^= dataBuffer[i];
        }

        // The last byte in the message is DataSUM
        uint8_t dataSUM = dataBuffer[messageLength - 1];

        if (checksum != dataSUM) {
            BluetoothScale::log("Checksum failed: calc[%02X] but actual[%02X]. Discarding.\n", checksum, dataSUM);
            dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageLength);
            return false;
        }

        float weight = (dataBuffer[7] << 16) | (dataBuffer[8] << 8) | dataBuffer[9];

        if (dataBuffer[6] == 45) { // Check if the value is negative
            weight = -weight;
        }

        BluetoothScale::setWeight(weight * 0.01f); // Convert to floating point
    } else if (productNumber == 0x03 && messageType == WeighMyBrewMessageType::SYSTEM) {
        WeighMyBrewScales::tare();
    } else {
        BluetoothScale::log("Unknown message type %02X: %s\n", messageType,
                            BluetoothScale::byteArrayToHexString(dataBuffer.data(), messageLength).c_str());
    }

    // Remove processed message from the buffer
    dataBuffer.erase(dataBuffer.begin(), dataBuffer.begin() + messageLength);

    // Return whether there's more data to process
    return dataBuffer.size() >= RECEIVE_PROTOCOL_LENGTH;
}

bool WeighMyBrewScales::performConnectionHandshake() {
    BluetoothScale::log("Performing handshake\n");

    service = BluetoothScale::clientGetService(serviceUUID);
    if (service != nullptr) {
        BluetoothScale::log("Got Service\n");
    } else {
        clientCleanup();
        return false;
    }

    weightCharacteristic = service->getCharacteristic(weightCharacteristicUUID);
    commandCharacteristic = service->getCharacteristic(commandCharacteristicUUID);
    if (weightCharacteristic == nullptr || commandCharacteristic == nullptr) {
        clientCleanup();
        return false;
    }
    BluetoothScale::log("Got weightCharacteristic and commandCharacteristic\n");

    sendNotificationRequest();
    BluetoothScale::log("Sent notification request\n");
    lastHeartbeat = millis();
    return true;
}

void WeighMyBrewScales::sendNotificationRequest() {
    uint8_t payload[] = {0, 0, 0, 0, 0, 0};
    sendEvent(payload, 6);
    BluetoothScale::log("Sent event.\n");
}

void WeighMyBrewScales::sendEvent(const uint8_t *payload, size_t length) {
    auto bytes = std::make_unique<uint8_t[]>(length + 1);
    bytes[0] = static_cast<uint8_t>(length + 1);

    for (size_t i = 0; i < length; ++i) {
        bytes[i + 1] = payload[i] & 0xFF;
    }

    sendMessage(WeighMyBrewMessageType::SYSTEM, bytes.get(), length + 1);
}

void WeighMyBrewScales::sendHeartbeat() {
    if (!isConnected()) {
        return;
    }

    uint32_t now = millis();
    if (now - lastHeartbeat < 2000) {
        return;
    }

    uint8_t payload1[] = {0x02, 0x00};
    sendMessage(WeighMyBrewMessageType::SYSTEM, payload1, 2);
    sendNotificationRequest();
    uint8_t payload2[] = {0x00};
    sendMessage(WeighMyBrewMessageType::SYSTEM, payload2, 1);
    lastHeartbeat = now;
}

void WeighMyBrewScales::subscribeToNotifications() {
    BluetoothScale::log("subscribeToNotifications\n");

    auto callback = [this](NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify) {
        notifyCallback(characteristic, data, length, isNotify);
    };

    if (weightCharacteristic->canNotify()) {
        BluetoothScale::log("Registering callback for weight characteristic\n");
        weightCharacteristic->subscribe(true, callback);
    }

    if (commandCharacteristic->canNotify()) {
        BluetoothScale::log("Registering callback for command characteristic\n");
        commandCharacteristic->subscribe(true, callback);
    }
}

void WeighMyBrewScales::sendMessage(WeighMyBrewMessageType msgType, const uint8_t *payload, size_t length, bool waitResponse) {

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
