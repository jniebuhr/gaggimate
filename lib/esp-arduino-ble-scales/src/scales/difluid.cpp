#include "difluid.h"
#include "remote_scales_plugin_registry.h"

/*
Handle protocol according to the provided specification.
*/

// Update service UUIDs and characteristic UUID
const NimBLEUUID tiserviceUUID("00DD");
const NimBLEUUID mbserviceUUID("00EE");
const NimBLEUUID weightCharacteristicUUID("AA01");

//-----------------------------------------------------------------------------------/
//---------------------------        PUBLIC       -----------------------------------/
//-----------------------------------------------------------------------------------/
DifluidScales::DifluidScales(const DiscoveredDevice& device) : RemoteScales(device) {}

bool DifluidScales::connect() {
    if (isConnected()) {
        log("Already connected\n");
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

void DifluidScales::disconnect() {
    clientCleanup();
}

bool DifluidScales::isConnected() {
    return clientIsConnected();
}

void DifluidScales::update() {
    if (markedForReconnection) {
        log("Marked for reconnection. Attempting to reconnect.\n");
        clientCleanup();
        connect();
        markedForReconnection = false;
    } else {
        sendHeartbeat();
    }
}

// Tare function
bool DifluidScales::tare() {
    if (!isConnected()) return false;
    log("Tare command sent.\n");
    uint8_t tareCommand[] = {0xDF, 0xDF, 0x03, 0x02, 0x01, 0x01, 0x00};
    tareCommand[6] = calculateChecksum(tareCommand, sizeof(tareCommand));
    weightCharacteristic->writeValue(tareCommand, sizeof(tareCommand), true);
    return true;
}

//-----------------------------------------------------------------------------------/
//---------------------------       PRIVATE       -----------------------------------/
//-----------------------------------------------------------------------------------/

int32_t DifluidScales::readInt32BE(const uint8_t* data) {
    return (int32_t)(
        ((uint32_t)data[0] << 24) |
        ((uint32_t)data[1] << 16) |
        ((uint32_t)data[2] << 8) |
        (uint32_t)data[3]
    );
}

void DifluidScales::notifyCallback(
    NimBLERemoteCharacteristic* pBLERemoteCharacteristic,
    uint8_t* pData,
    size_t length,
    bool isNotify
) {
    // Use the log function from RemoteScales
    log("Notification received:\n");
    for (size_t i = 0; i < length; i++) {
        log("%02X ", pData[i]);
    }
    log("\n");

    // Verify headers
    if (length < 6 || pData[0] != 0xDF || pData[1] != 0xDF) {
        log("Invalid data received.\n");
        return;
    }

    // Verify checksum
    uint8_t receivedChecksum = pData[length - 1];
    uint8_t calculatedChecksum = calculateChecksum(pData, length);
    if (receivedChecksum != calculatedChecksum) {
        log("Checksum mismatch. Received: %02X, Calculated: %02X\n", receivedChecksum, calculatedChecksum);
        return;
    }

    uint8_t func = pData[2];
    uint8_t cmd = pData[3];
    uint8_t dataLen = pData[4];

    if (func == 0x03 && cmd == 0x00) { // Sensor Data
        if (dataLen >= 13 && length >= 6 + dataLen) {
            // Parse sensor data
            int32_t weightRaw = readInt32BE(&pData[5]);
            float weight = weightRaw / 10.0f; // Assuming weight unit is grams x10

            // Handle other data fields if necessary
            // ...

            log("Weight: %.1f g\n", weight);

            // Call weight updated callback
            setWeight(weight);
        } else {
            log("Invalid sensor data length.\n");
        }
    } else if (func == 0x03 && cmd == 0x05) { // Heartbeat Acknowledgment(Get Device Status)
        log("Heartbeat acknowledged.\n");
        uint8_t battery_capacity = pData[6];  // Battery capacity percentage.
    } else {
        log("Unknown function (%02X) or command (%02X).\n", func, cmd);
    }
}


bool DifluidScales::performConnectionHandshake() {
    log("Performing handshake\n");

    // Try to get the service using both UUIDs
    service = clientGetService(mbserviceUUID);
    if (service == nullptr) {
        service = clientGetService(tiserviceUUID);
    }

    if (service == nullptr) {
        log("Service not found with UUIDs 00EE or 00DD.\n");
        return false;
    }
    log("Service found.\n");

    weightCharacteristic = service->getCharacteristic(weightCharacteristicUUID);
    if (weightCharacteristic == nullptr) {
        log("Characteristic not found.\n");
        return false;
    }
    log("Characteristic found.\n");

    // Subscribe to notifications
    if (weightCharacteristic->canNotify()) {
        weightCharacteristic->subscribe(true, [this](NimBLERemoteCharacteristic* characteristic, uint8_t* data, size_t length, bool isNotify) {
            notifyCallback(characteristic, data, length, isNotify);
        });
    } else {
        log("Cannot subscribe to notifications.\n");
        return false;
    }

    // Set the scale unit to grams
    setUnitToGram();

    // Enable auto notifications
    enableAutoNotifications();

    // Initialize heartbeat timer
    lastHeartbeat = millis();

    return true;
}

void DifluidScales::setUnitToGram() {
    uint8_t unitToGramCommand[] = {0xDF, 0xDF, 0x01, 0x04, 0x01, 0x00, 0x00}; // Last byte for checksum
    unitToGramCommand[6] = calculateChecksum(unitToGramCommand, sizeof(unitToGramCommand));
    weightCharacteristic->writeValue(unitToGramCommand, sizeof(unitToGramCommand), true);
    log("Set unit to grams.\n");
}

void DifluidScales::enableAutoNotifications() {
    uint8_t enableNotificationsCommand[] = {0xDF, 0xDF, 0x01, 0x00, 0x01, 0x01, 0x00};
    enableNotificationsCommand[6] = calculateChecksum(enableNotificationsCommand, sizeof(enableNotificationsCommand));
    weightCharacteristic->writeValue(enableNotificationsCommand, sizeof(enableNotificationsCommand), true);
    log("Enabled auto notifications.\n");
}

void DifluidScales::sendHeartbeat() {
    if (!isConnected()) {
        markedForReconnection=true;
        return;
    }

    uint32_t now = millis();
    if (now - lastHeartbeat < 2000) {
        return;
    }

    uint8_t heartbeatCommand[] = {0xDF, 0xDF, 0x03, 0x05, 0x00, 0xC6};  // Use Func 0x03 and Cmd 0x05(Get Device Status) as the heartbeat.
    heartbeatCommand[5] = calculateChecksum(heartbeatCommand, sizeof(heartbeatCommand));
    weightCharacteristic->writeValue(heartbeatCommand, sizeof(heartbeatCommand), true);
    lastHeartbeat = now;
}

// Calculate checksum according to the protocol
uint8_t DifluidScales::calculateChecksum(const uint8_t* data, size_t length) {
    uint16_t sum = 0;
    // Sum all bytes except the checksum byte itself
    for (size_t i = 0; i < length - 1; i++) {
        sum += data[i];
    }
    return static_cast<uint8_t>(sum & 0xFF);
}
