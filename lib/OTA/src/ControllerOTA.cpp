#include "ControllerOTA.h"
#include "EspHttpTransport.h"
#include "ResumableDownloader.h"
#include <LittleFS.h>
#include <esp_app_format.h>

void ControllerOTA::init(const ctr_progress_callback_t &progress_callback) {
    ESP_LOGI("ControllerOTA", "Initializing ControllerOTA");
    progressCallback = progress_callback;
}

bool ControllerOTA::resolveCharacteristics() {
    rxChar = nullptr;
    txChar = nullptr;
    if (client == nullptr || !client->isConnected()) {
        ESP_LOGE("ControllerOTA", "No BLE connection to the controller");
        return false;
    }
    NimBLERemoteService *pRemoteService = client->getService(NimBLEUUID(SERVICE_OTA_BLE_UUID));
    if (pRemoteService == nullptr) {
        ESP_LOGE("ControllerOTA", "OTA BLE service not found");
        return false;
    }
    NimBLERemoteCharacteristic *rx = pRemoteService->getCharacteristic(NimBLEUUID(CHARACTERISTIC_OTA_BL_UUID_RX));
    NimBLERemoteCharacteristic *tx = pRemoteService->getCharacteristic(NimBLEUUID(CHARACTERISTIC_OTA_BL_UUID_TX));
    if (rx == nullptr || tx == nullptr) {
        ESP_LOGE("ControllerOTA", "OTA BLE characteristics not found");
        return false;
    }
    if (!tx->canNotify() ||
        !tx->subscribe(true, std::bind(&ControllerOTA::onReceive, this, std::placeholders::_1, std::placeholders::_2,
                                       std::placeholders::_3, std::placeholders::_4))) {
        ESP_LOGE("ControllerOTA", "Failed to subscribe to the OTA notification characteristic");
        return false;
    }
    rxChar = rx;
    txChar = tx;
    lastSignal = 0x00;
    return true;
}

bool ControllerOTA::update(NimBLEClient *ble_client, const String &release_url) {
    // Fail before the download
    this->client = ble_client;
    if (client == nullptr || !client->isConnected()) {
        ESP_LOGE("ControllerOTA", "Controller not connected, skipping update");
        return false;
    }
    if (LittleFS.exists(CONTROLLER_FIRMWARE_PATH)) {
        ESP_LOGI("ControllerOTA", "Removing previous update file");
        LittleFS.remove(CONTROLLER_FIRMWARE_PATH);
    }
    if (!downloadFile(release_url)) {
        ESP_LOGE("ControllerOTA", "Download of firmware file failed");
        return false;
    }
    if (!resolveCharacteristics()) {
        ESP_LOGE("ControllerOTA", "Could not reach the controller OTA service, aborting");
        return false;
    }
    File file = LittleFS.open(CONTROLLER_FIRMWARE_PATH, FILE_READ);
    if (!file) {
        ESP_LOGE("ControllerOTA", "Could not open the downloaded firmware file");
        rxChar = nullptr;
        txChar = nullptr;
        return false;
    }
    // Below DEFAULT_MTU the one-byte packet index overflows a part (and 0 means the link is gone), so never go lower.
    const uint16_t attMtu = client->getMTU();
    _currentMtu = attMtu > DEFAULT_MTU + STACK_MTU_OFFSET ? attMtu - STACK_MTU_OFFSET : DEFAULT_MTU;
    if (_currentMtu > MAX_MTU)
        _currentMtu = MAX_MTU;
    ESP_LOGI("ControllerOTA", "ATT MTU %u, sending %u byte packets", attMtu, _currentMtu);
    bool ok = runUpdate(file, file.size());
    file.close();
    // Drop the pointers again; the next update re-resolves them against the live connection.
    rxChar = nullptr;
    txChar = nullptr;
    return ok;
}

bool ControllerOTA::downloadFile(const String &release_url) {
    File file = LittleFS.open(CONTROLLER_FIRMWARE_PATH, FILE_WRITE, true);
    if (!file) {
        ESP_LOGE("ControllerOTA", "Could not create %s", CONTROLLER_FIRMWARE_PATH);
        return false;
    }
    DownloadSink sink;
    sink.write = [&](const uint8_t *data, size_t len) {
        if (file.position() == 0 && data[0] != ESP_IMAGE_HEADER_MAGIC) {
            ESP_LOGE("ControllerOTA", "Magic header does not start with 0xE9");
            return false;
        }
        return file.write(data, len) == len;
    };
    sink.restart = [&]() {
        file.close();
        file = LittleFS.open(CONTROLLER_FIRMWARE_PATH, FILE_WRITE, true);
        return static_cast<bool>(file);
    };
    EspHttpTransport transport;
    EspDownloadEnv env;
    ResumableDownloader downloader(transport, env, release_url.c_str(), sink, [this](size_t received, size_t total) {
        if (total > 0 || received == 0) {
            progressCallback(total > 0 ? static_cast<int>((static_cast<uint64_t>(received) * 50) / total) : 0);
        }
    });
    bool ok = downloader.run() && downloader.received() > 0;
    file.close();
    if (!ok) {
        LittleFS.remove(CONTROLLER_FIRMWARE_PATH);
        return false;
    }
    ESP_LOGI("ControllerOTA", "Downloaded firmware file with %u bytes to %s", static_cast<unsigned>(downloader.received()),
             CONTROLLER_FIRMWARE_PATH);
    return true;
}

bool ControllerOTA::runUpdate(Stream &in, uint32_t size) {
    ESP_LOGI("ControllerOTA", "Sending update instructions over BLE. File Size: %d", size);
    fileParts = (size + PART_SIZE - 1) / PART_SIZE;
    currentPart = 0;

    uint8_t fileLengthBytes[] = {
        0xFE,
        static_cast<uint8_t>((size >> 24) & 0xFF),
        static_cast<uint8_t>((size >> 16) & 0xFF),
        static_cast<uint8_t>((size >> 8) & 0xFF),
        static_cast<uint8_t>(size & 0xFF),
    };
    uint8_t partsAndMTU[] = {
        0xFF,
        static_cast<uint8_t>(fileParts / 256),
        static_cast<uint8_t>(fileParts % 256),
        static_cast<uint8_t>(_currentMtu / 256),
        static_cast<uint8_t>(_currentMtu % 256),
    };
    uint8_t updateStart[] = {0xFD};
    lastSignal = 0x00;
    fastMode = false;
    if (!sendData(fileLengthBytes, 5) || !sendData(partsAndMTU, 5) || !sendData(updateStart, 1)) {
        ESP_LOGE("ControllerOTA", "Failed to send update instructions, aborting");
        return false;
    }
    ESP_LOGI("ControllerOTA", "Waiting for signal from controller");
    if (waitForSignal() != 0xAA) {
        ESP_LOGE("ControllerOTA", "Controller did not start the transfer, aborting");
        return false;
    }
    ESP_LOGI("ControllerOTA", "Starting transfer in %s mode", fastMode ? "fast" : "slow");

    const uint32_t startedAt = millis();
    while (currentPart < fileParts) {
        lastSignal = 0x00;
        ESP_LOGV("ControllerOTA", "Sending part %d / %d", currentPart + 1, fileParts);
        if (!sendPart(in, size)) {
            ESP_LOGE("ControllerOTA", "Transfer aborted at part %d / %d", currentPart + 1, fileParts);
            return false;
        }
        currentPart++;
        notifyUpdate();
        if (lastSignal == 0x0F) {
            ESP_LOGE("ControllerOTA", "Controller rejected part %d / %d, aborting", currentPart, fileParts);
            return false;
        }
        // Fast mode streams on; the acknowledged 0xFC write already holds us back until the part is flashed.
        if (currentPart < fileParts && !fastMode && waitForSignal() != 0xF1) {
            ESP_LOGE("ControllerOTA", "Controller did not request part %d / %d, aborting", currentPart + 1, fileParts);
            return false;
        }
    }
    ESP_LOGI("ControllerOTA", "Sent %u bytes in %u ms", size, millis() - startedAt);

    const uint8_t signal = waitForSignal();
    if (signal == 0xF2 || signal == 0xFF) {
        ESP_LOGI("ControllerOTA", "Controller update finished");
        return true;
    }
    ESP_LOGE("ControllerOTA", "Controller did not confirm the update (signal 0x%x)", signal);
    return false;
}

uint8_t ControllerOTA::waitForSignal() {
    const uint32_t start = millis();
    while (client->isConnected() && millis() - start < SIGNAL_TIMEOUT_MS) {
        const uint8_t signal = lastSignal;
        if (signal != 0x00) {
            lastSignal = 0x00;
            return signal;
        }
        delay(SIGNAL_POLL_MS);
    }
    if (client->isConnected())
        ESP_LOGE("ControllerOTA", "No signal from the controller for %u ms", SIGNAL_TIMEOUT_MS);
    else
        ESP_LOGE("ControllerOTA", "Controller disconnected");
    return 0x00;
}

bool ControllerOTA::sendData(uint8_t *data, uint16_t len, bool response) const {
    if (rxChar == nullptr) {
        ESP_LOGE("ControllerOTA", "RX Char uninitialized");
        return false;
    }
    // The characteristic belongs to the connection; a dropped link makes it stale, so re-check before every write.
    if (client == nullptr || !client->isConnected()) {
        ESP_LOGE("ControllerOTA", "Controller disconnected during transfer");
        return false;
    }
    // A write without response fails while the stack is out of TX buffers; back off and retry rather than drop the packet.
    for (uint16_t attempt = 0; attempt < WRITE_NR_RETRIES; attempt++) {
        if (rxChar->writeValue(data, len, response))
            return true;
        if (response || !client->isConnected())
            break;
        delay(WRITE_NR_BACKOFF_MS);
    }
    ESP_LOGE("ControllerOTA", "BLE write failed");
    return false;
}

bool ControllerOTA::fillBuffer(Stream &in, uint8_t *buffer, uint16_t len) const {
    size_t bufferLen = 0;
    size_t bytesToRead = len;
    size_t toRead = 0;
    size_t timeout_failures = 0;
    while (bufferLen < len) {
        while (!toRead) {
            toRead = in.readBytes(buffer + bufferLen, bytesToRead);
            if (toRead == 0) {
                timeout_failures++;
                if (timeout_failures >= 300) {
                    ESP_LOGE("ControllerOTA", "Failed to read data from stream");
                    return false;
                }
                ESP_LOGW("ControllerOTA", "Failed to read data from stream. Request %d bytes", bytesToRead);
                delay(100);
            }
        }
        bufferLen += toRead;
        bytesToRead = len - bufferLen;
        toRead = 0;
    }
    ESP_LOGV("ControllerOTA", "Read %d bytes", bufferLen);
    return true;
}

void ControllerOTA::notifyUpdate() const {
    double progress = (static_cast<double>(currentPart) / static_cast<double>(fileParts)) * 50.0 + 50.0;
    progressCallback(static_cast<int>(progress));
}

bool ControllerOTA::sendPart(Stream &in, uint32_t totalSize) const {
    uint8_t partData[MAX_MTU + 2];
    uint8_t buffer[MAX_MTU];
    partData[0] = 0xFB;
    uint32_t partLength = PART_SIZE;
    if ((currentPart + 1) * PART_SIZE > totalSize) {
        partLength = totalSize - (currentPart * PART_SIZE);
    }
    uint8_t parts = partLength / _currentMtu;
    for (uint8_t part = 0; part < parts; part++) {
        partData[1] = part;
        if (!fillBuffer(in, buffer, _currentMtu))
            return false;
        for (uint32_t i = 0; i < _currentMtu; i++) {
            partData[i + 2] = buffer[i];
        }
        ESP_LOGV("ControllerOTA", "Sending part %d / %d - package %d / %d", currentPart + 1, fileParts, part + 1, parts);
        if (!sendData(partData, _currentMtu + 2, false))
            return false;
    }
    if (partLength % _currentMtu > 0) {
        uint32_t remaining = partLength % _currentMtu;
        uint8_t remainingData[MAX_MTU + 2];
        remainingData[0] = 0xFB;
        remainingData[1] = parts;
        if (!fillBuffer(in, buffer, remaining))
            return false;
        for (uint32_t i = 0; i < remaining; i++) {
            remainingData[i + 2] = buffer[i];
        }
        if (!sendData(remainingData, remaining + 2, false))
            return false;
    }
    uint8_t footer[5];
    footer[0] = 0xFC;
    footer[1] = partLength / 256;
    footer[2] = partLength % 256;
    footer[3] = currentPart / 256;
    footer[4] = currentPart % 256;
    return sendData(footer, sizeof(footer));
}

void ControllerOTA::onReceive(NimBLERemoteCharacteristic *pRemoteCharacteristic, uint8_t *pData, size_t length, bool isNotify) {
    if (length == 0)
        return;
    // Publish the mode before the signal; the loop task reads fastMode once it sees 0xAA.
    if (pData[0] == 0xAA)
        fastMode = length > 1 && pData[1] != 0;
    lastSignal = pData[0];
    ESP_LOGI("ControllerOTA", "Received signal 0x%x", pData[0]);
    switch (pData[0]) {
    case 0xAA:
        ESP_LOGI("ControllerOTA", "Starting transfer, controller requests %s mode", fastMode ? "fast" : "slow");
        break;
    case 0xF1:
        ESP_LOGI("ControllerOTA", "Next part requested");
        break;
    case 0xF2:
        ESP_LOGI("ControllerOTA", "Controller installing firmware");
        break;
    case 0x0F:
        ESP_LOGE("ControllerOTA", "Controller reported an error: %.*s", static_cast<int>(length - 1), pData + 1);
        break;
    default:
        ESP_LOGI("ControllerOTA", "Unhandled message");
        break;
    }
}
