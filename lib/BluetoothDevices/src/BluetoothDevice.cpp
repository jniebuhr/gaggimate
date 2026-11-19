#include "BluetoothDevice.h"

const char *bluetoothDeviceTypeName(BluetoothDeviceType type) {
    switch (type) {
    case BluetoothDeviceType::GRINDER:
        return "grinder";
    case BluetoothDeviceType::SCALE:
    default:
        return "scale";
    }
}

bool bluetoothDeviceTypeFromName(const std::string &name, BluetoothDeviceType &type) {
    for (size_t i = 0; i < BLUETOOTH_DEVICE_TYPE_COUNT; i++) {
        const auto candidate = static_cast<BluetoothDeviceType>(i);
        if (name == bluetoothDeviceTypeName(candidate)) {
            type = candidate;
            return true;
        }
    }
    return false;
}

static const char *logPrefix(BluetoothDeviceType type) { return type == BluetoothDeviceType::GRINDER ? "Grinder[" : "Scale["; }

BluetoothDevice::BluetoothDevice(const DiscoveredDevice &device, BluetoothDeviceType type) : type(type), device(device) {}

BluetoothDevice::~BluetoothDevice() noexcept {
    try {
        clientCleanup();
    } catch (...) {
        // Destructors must not propagate exceptions.
    }
}

void BluetoothDevice::log(std::string msgFormat, ...) {
    if (!this->logCallback)
        return;

    va_list args;
    va_start(args, msgFormat);
    int length = vsnprintf(nullptr, 0, msgFormat.c_str(), args); // Find length of string
    va_end(args);                                                // End before restarting

    if (length < 0) {
        logCallback(logPrefix(type) + device.getName() + "] Error: Invalid message format");
        return;
    }

    va_start(args, msgFormat);                                            // Restart for the actual printing
    std::string formattedMessage(length + 1, '\0');                       // Instantiate formatted strigng with correct length
    vsnprintf(&formattedMessage[0], length + 1, msgFormat.c_str(), args); // print formatted message in the string
    formattedMessage.resize(length);                                      // Remove the trailing null character
    va_end(args);
    logCallback(logPrefix(type) + device.getName() + "] " + formattedMessage);
}

// NimBLE's 30 s default keeps the caller blocked and the radio initiating long after a device has stopped advertising.
static constexpr uint8_t CONNECT_TIMEOUT_SECONDS = 5;

bool BluetoothDevice::clientConnect() {
    clientCleanup();
    log("Connecting to BLE client\n");
    client = NimBLEDevice::createClient(device.getAddress());
    client->setConnectTimeout(CONNECT_TIMEOUT_SECONDS);
    return client->connect();
}

void BluetoothDevice::clientCleanup() {
    if (client == nullptr) {
        return;
    }
    log("Cleaning up BLE client\n");
    NimBLEDevice::deleteClient(client);
    client = nullptr;
}

NimBLERemoteService *BluetoothDevice::clientGetService(const NimBLEUUID uuid) {
    if (!clientIsConnected()) {
        log("Cannot get service, client is not connected\n");
        return nullptr;
    }
    return client->getService(uuid);
}

bool BluetoothDevice::clientIsConnected() { return client != nullptr && client->isConnected(); };

uint16_t BluetoothDevice::clientGetMTU() { return clientIsConnected() ? client->getMTU() : 0; }

std::string BluetoothDevice::byteArrayToHexString(const uint8_t *byteArray, size_t length) {
    std::string hexString;
    hexString.reserve(length * 3); // Reserve space for the resulting string

    char hex[4];
    for (size_t i = 0; i < length; i++) {
        snprintf(hex, sizeof(hex), "%02X ", byteArray[i]);
        hexString.append(hex);
    }

    return hexString;
}
