#include "bookoo_motto.h"
#include <algorithm>

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
    step = pendingSettings.isEmpty() ? Step::NONE : Step::QUEUED;
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

    const bool awaitingResponse = step != Step::NONE && step != Step::QUEUED && step != Step::WAIT_FOR_IDLE;
    if (awaitingResponse && millis() - requestSentAt > RESPONSE_TIMEOUT_MS) {
        log("No answer from the grinder, starting over\n");
        step = Step::QUEUED;
    }
    if (step == Step::WAIT_FOR_IDLE && getState() == GrinderState::IDLE) {
        step = Step::QUEUED;
    }
    if (step == Step::QUEUED && ready) {
        startTransfer();
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
        setReportedSettings(message.reported);
        setState(message.state);
    }
    if (message.hasSettingsResponse || message.hasPresetResponse) {
        handleResponse(message);
    }
}

bool BookooMottoGrinder::applySettings(const GrinderSettings &settings) {
    if (settings.isEmpty()) {
        return false;
    }
    pendingSettings = settings;
    step = Step::QUEUED;
    settingsAttempts = 0;
    return isConnected();
}

void BookooMottoGrinder::startTransfer() {
    if (settingsAttempts >= SETTINGS_MAX_ATTEMPTS) {
        log("Giving up on the settings after %d attempts\n", static_cast<int>(settingsAttempts));
        step = Step::NONE;
        return;
    }
    settingsAttempts++;
    presetValues = pendingSettings;
    // A preset needs all three values: take what the recipe leaves open from the grinder's general settings.
    if (!presetValues.hasGrindSize() || !presetValues.hasRpm() || !presetValues.hasFeedRpm()) {
        sendRequest(Step::FETCH_GENERAL, motto::buildGeneralSettingsQuery());
    } else {
        sendRequest(Step::LIST_PRESETS, motto::buildPresetListRequest());
    }
}

void BookooMottoGrinder::sendRequest(Step next, const std::string &json) {
    if (!sendJson(json)) {
        log("Sending a request failed\n");
        step = Step::QUEUED;
        return;
    }
    step = next;
    requestSentAt = millis();
}

void BookooMottoGrinder::failTransfer(const motto::Message &message) {
    if (message.errorCode == "INVALID_STATE") {
        // The grinder is busy (grinding, cleaning, in its menu); start over once it reports idle.
        log("Grinder busy, settings wait for idle\n");
        step = Step::WAIT_FOR_IDLE;
        return;
    }
    log("Request rejected: %s %s %s\n", message.errorCode.c_str(), message.errorMessage.c_str(), message.errorField.c_str());
    step = Step::NONE;
}

void BookooMottoGrinder::handleResponse(const motto::Message &message) {
    const std::string uid = motto::GAGGIMATE_PRESET_UID;
    const std::string name = motto::buildPresetName(pendingSettings.label, pendingSettings.dose);
    switch (step) {
    case Step::FETCH_GENERAL:
        if (!message.hasSettingsResponse) {
            return;
        }
        if (!message.settingsAccepted) {
            failTransfer(message);
            return;
        }
        if (!presetValues.hasGrindSize())
            presetValues.grindSize = message.general.grindSize;
        if (!presetValues.hasRpm())
            presetValues.rpm = message.general.rpm;
        if (!presetValues.hasFeedRpm())
            presetValues.feedRpm = message.general.feedRpm;
        sendRequest(Step::LIST_PRESETS, motto::buildPresetListRequest());
        return;

    case Step::LIST_PRESETS: {
        if (!message.hasPresetResponse) {
            return;
        }
        if (!message.presetAccepted || !message.presetList) {
            failTransfer(message);
            return;
        }
        const auto &uids = message.presetUids;
        const int count = static_cast<int>(uids.size());
        if (std::find(uids.begin(), uids.end(), uid) != uids.end()) {
            sendRequest(Step::WRITE_PRESET, motto::buildPresetUpdateRequest(uid, name, presetValues));
        } else if (count < motto::PRESET_LIMIT) {
            // New presets go to the end of the list, behind the user's own.
            sendRequest(Step::WRITE_PRESET, motto::buildPresetAddRequest(uid, count, name, presetValues));
        } else {
            log("All %d presets are in use, writing the general settings instead\n", count);
            sendRequest(Step::WRITE_GENERAL, motto::buildSettingsRequest(pendingSettings));
        }
        return;
    }

    case Step::RESTORE_PRESET:
        if (!message.hasPresetResponse) {
            return;
        }
        if (!message.presetAccepted) {
            failTransfer(message);
            return;
        }
        sendRequest(Step::WRITE_PRESET, motto::buildPresetUpdateRequest(uid, name, presetValues));
        return;

    case Step::WRITE_PRESET:
        if (!message.hasPresetResponse) {
            return;
        }
        if (!message.presetAccepted && message.errorCode == "PRESET_UID_DUPLICATE") {
            // Deleted on the grinder earlier: the id is still taken by the recycle bin entry.
            sendRequest(Step::RESTORE_PRESET, motto::buildPresetRestoreRequest(uid));
            return;
        }
        if (!message.presetAccepted || message.presetIndex == motto::PRESET_NONE) {
            failTransfer(message);
            return;
        }
        log("Preset \"%s\" written at index %d\n", name.c_str(), message.presetIndex);
        sendRequest(Step::SELECT_PRESET, motto::buildSelectPresetRequest(message.presetIndex));
        return;

    case Step::SELECT_PRESET:
    case Step::WRITE_GENERAL:
        if (!message.hasSettingsResponse) {
            return;
        }
        if (!message.settingsAccepted) {
            failTransfer(message);
            return;
        }
        log(step == Step::SELECT_PRESET ? "Preset selected\n" : "General settings applied\n");
        step = Step::NONE;
        return;

    default:
        return;
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
