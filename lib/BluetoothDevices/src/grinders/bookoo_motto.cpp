#include "bookoo_motto.h"

static const NimBLEUUID serviceUUID(motto::SERVICE_UUID);
static const NimBLEUUID rxCharacteristicUUID(motto::RX_CHARACTERISTIC_UUID);
static const NimBLEUUID txCharacteristicUUID(motto::TX_CHARACTERISTIC_UUID);

BookooMottoGrinder::BookooMottoGrinder(const DiscoveredDevice &device) : BluetoothGrinder(device) {}

bool BookooMottoGrinder::connect() {
    if (clientIsConnected()) {
        log("Already connected\n");
        return true;
    }

    log("Connecting to %s[%s]\n", getDeviceName().c_str(), getDeviceAddress().c_str());
    if (!clientConnect() || !discoverCharacteristics()) {
        clientCleanup();
        return false;
    }

    reassembler.reset();
    {
        std::lock_guard<std::mutex> lock(inboxMutex);
        inbox.clear();
    }
    ready = false;
    transfer = pendingSettings.isEmpty() ? SettingsTransfer::NONE : SettingsTransfer::QUEUED;
    settingsAttempts = 0;

    auto callback = [this](NimBLERemoteCharacteristic *, uint8_t *data, size_t length, bool) { onNotification(data, length); };
    if (!txCharacteristic->subscribe(true, callback)) {
        log("Subscribing to notifications failed\n");
        clientCleanup();
        return false;
    }
    // Every connection needs a fresh subscription and handshake before the grinder talks.
    if (!sendJson(motto::buildHandshakeRequest())) {
        log("Sending the handshake failed\n");
        clientCleanup();
        return false;
    }
    log("Handshake sent\n");
    return true;
}

void BookooMottoGrinder::disconnect() {
    clientCleanup();
    rxCharacteristic = nullptr;
    txCharacteristic = nullptr;
    ready = false;
    setState(GrinderState::UNKNOWN);
}

bool BookooMottoGrinder::isConnected() { return clientIsConnected(); }

bool BookooMottoGrinder::discoverCharacteristics() {
    NimBLERemoteService *service = clientGetService(serviceUUID);
    if (service == nullptr) {
        log("Custom GATT service not found, grinder firmware too old?\n");
        return false;
    }
    rxCharacteristic = service->getCharacteristic(rxCharacteristicUUID);
    txCharacteristic = service->getCharacteristic(txCharacteristicUUID);
    if (rxCharacteristic == nullptr || txCharacteristic == nullptr) {
        log("RX or TX characteristic not found\n");
        return false;
    }
    if (!(rxCharacteristic->canWrite() || rxCharacteristic->canWriteNoResponse()) || !txCharacteristic->canNotify()) {
        log("RX is not writable or TX cannot notify\n");
        return false;
    }
    return true;
}

// Runs on the NimBLE host task: only reassemble and queue, parsing happens in update().
void BookooMottoGrinder::onNotification(const uint8_t *data, size_t length) {
    std::string message;
    if (!reassembler.feed(data, length, millis(), message)) {
        return;
    }
    std::lock_guard<std::mutex> lock(inboxMutex);
    if (inbox.size() >= INBOX_LIMIT) {
        inbox.erase(inbox.begin());
    }
    inbox.push_back(std::move(message));
}

void BookooMottoGrinder::update() {
    if (!isConnected()) {
        return;
    }
    std::vector<std::string> messages;
    {
        std::lock_guard<std::mutex> lock(inboxMutex);
        messages.swap(inbox);
    }
    for (const std::string &json : messages) {
        handleMessage(json);
    }

    if (transfer == SettingsTransfer::SENT && millis() - settingsSentAt > RESPONSE_TIMEOUT_MS) {
        log("No answer to the settings request\n");
        transfer = SettingsTransfer::QUEUED;
    }
    if (transfer == SettingsTransfer::WAIT_FOR_IDLE && getState() == GrinderState::IDLE) {
        transfer = SettingsTransfer::QUEUED;
    }
    if (transfer == SettingsTransfer::QUEUED && ready) {
        sendPendingSettings();
    }
}

void BookooMottoGrinder::handleMessage(const std::string &json) {
    motto::Message message;
    if (!motto::parseMessage(json, message)) {
        log("Ignoring invalid message\n");
        return;
    }
    if (message.hasBaseInfo) {
        log("Firmware %u, serial %s\n", static_cast<unsigned>(message.releaseVersion), message.serialNumber.c_str());
    }
    if (message.hasPeriodInfo) {
        if (!ready) {
            log("Data channel ready\n");
        }
        ready = true;
        selectedPreset = message.selectedPreset;
        setReportedSettings(message.reported);
        setState(message.state);
    }
    if (message.hasSettingsResponse && transfer == SettingsTransfer::SENT) {
        if (message.settingsAccepted) {
            log("Settings applied\n");
            transfer = SettingsTransfer::NONE;
        } else if (message.errorCode == "INVALID_STATE") {
            // The grinder is busy (grinding, cleaning, in its menu); try again once it reports idle.
            log("Grinder busy, settings wait for idle\n");
            transfer = SettingsTransfer::WAIT_FOR_IDLE;
        } else {
            log("Settings rejected: %s %s %s\n", message.errorCode.c_str(), message.errorMessage.c_str(),
                message.errorField.c_str());
            transfer = SettingsTransfer::NONE;
        }
    }
}

bool BookooMottoGrinder::applySettings(const GrinderSettings &settings) {
    if (settings.isEmpty()) {
        return false;
    }
    pendingSettings = settings;
    transfer = SettingsTransfer::QUEUED;
    settingsAttempts = 0;
    return isConnected();
}

void BookooMottoGrinder::sendPendingSettings() {
    if (settingsAttempts >= SETTINGS_MAX_ATTEMPTS) {
        log("Giving up on the settings after %d attempts\n", static_cast<int>(settingsAttempts));
        transfer = SettingsTransfer::NONE;
        return;
    }
    if (selectedPreset >= 0) {
        log("Grinder runs user preset %d, the general settings may not be in effect\n", selectedPreset);
    }
    settingsAttempts++;
    if (sendJson(motto::buildSettingsRequest(pendingSettings))) {
        log("Settings sent: grind size %.0f, %d rpm, feed %d rpm\n", pendingSettings.grindSize, pendingSettings.rpm,
            pendingSettings.feedRpm);
        transfer = SettingsTransfer::SENT;
        settingsSentAt = millis();
    } else {
        log("Sending the settings failed\n");
    }
}

bool BookooMottoGrinder::sendJson(const std::string &json) {
    if (rxCharacteristic == nullptr || !isConnected()) {
        return false;
    }
    const size_t packetLength = motto::packetLengthForMtu(clientGetMTU());
    const std::vector<std::string> packets = motto::encodeFragments(json, sequence++, packetLength);
    if (packets.empty()) {
        return false;
    }
    // Acknowledged writes keep the fragments in order without extra flow control.
    const bool withResponse = rxCharacteristic->canWrite();
    for (const std::string &packet : packets) {
        if (!rxCharacteristic->writeValue(reinterpret_cast<const uint8_t *>(packet.data()), packet.size(), withResponse)) {
            return false;
        }
    }
    return true;
}
