#include "ControllerOTA.h"
#include <HTTPClient.h>
#include <LittleFS.h>

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

void ControllerOTA::update(NimBLEClient *ble_client, WiFiClientSecure &wifi_client, const String &release_url) {
    // Fail before the download
    this->client = ble_client;
    if (client == nullptr || !client->isConnected()) {
        ESP_LOGE("ControllerOTA", "Controller not connected, skipping update");
        return;
    }
    if (LittleFS.exists("/board-firmware.bin")) {
        ESP_LOGI("ControllerOTA", "Removing previous update file");
        LittleFS.remove("/board-firmware.bin");
    }
    if (!downloadFile(wifi_client, release_url)) {
        ESP_LOGE("ControllerOTA", "Download of firmware file failed");
        return;
    }
    if (!resolveCharacteristics()) {
        ESP_LOGE("ControllerOTA", "Could not reach the controller OTA service, aborting");
        return;
    }
    File file = LittleFS.open("/board-firmware.bin", FILE_READ);
    if (!file) {
        ESP_LOGE("ControllerOTA", "Could not open the downloaded firmware file");
        rxChar = nullptr;
        txChar = nullptr;
        return;
    }
    runUpdate(file, file.size());
    file.close();
    // Drop the pointers again; the next update re-resolves them against the live connection.
    rxChar = nullptr;
    txChar = nullptr;
}

bool ControllerOTA::downloadFile(WiFiClientSecure &wifi_client, const String &release_url) {
    HTTPClient http;
    if (!http.begin(wifi_client, release_url)) {
        ESP_LOGE("ControllerOTA", "Failed to start http client");
        return false;
    }

    http.useHTTP10(true);
    http.setTimeout(60000);
    http.setConnectTimeout(10000);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.setUserAgent("ESP32-http-Update");
    http.addHeader("Cache-Control", "no-cache");
    int code = http.GET();
    int len = http.getSize();

    if (code != HTTP_CODE_OK) {
        ESP_LOGE("ControllerOTA", "HTTP error: %d", code);
        http.end();
        return false;
    }

    if (len == 0) {
        ESP_LOGE("ControllerOTA", "Could not fetch firmware");
        http.end();
        return false;
    }

    WiFiClient *tcp = http.getStreamPtr();
    delay(100);

    if (tcp->peek() != 0xE9) {
        ESP_LOGE("ControllerOTA", "Magic header does not start with 0xE9");
        http.end();
        return false;
    }

    File file = LittleFS.open("/board-firmware.bin", FILE_WRITE, true);

    int written = 0;
    while (written < len) {
        int bufferSize = min(1024, len - written);
        uint8_t buffer[bufferSize];
        fillBuffer(*tcp, buffer, bufferSize);
        file.write(buffer, bufferSize);
        written += bufferSize;
        double progress = (static_cast<double>(written) / static_cast<double>(len)) * 50.0;
        progressCallback(static_cast<int>(progress));
    }
    ESP_LOGI("ControllerOTA", "Downloaded firmware file with %d bytes to /board-firmware.bin", len);
    file.close();
    http.end();
    return true;
}

void ControllerOTA::runUpdate(Stream &in, uint32_t size) {
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
        static_cast<uint8_t>(MTU / 256),
        static_cast<uint8_t>(MTU % 256),
    };
    uint8_t updateStart[] = {0xFD};
    if (!sendData(fileLengthBytes, 5) || !sendData(partsAndMTU, 5) || !sendData(updateStart, 1)) {
        ESP_LOGE("ControllerOTA", "Failed to send update instructions, aborting");
        return;
    }
    ESP_LOGI("ControllerOTA", "Waiting for signal from controller");

    while (client->isConnected()) {
        uint8_t signal = lastSignal;
        lastSignal = 0x00;
        if (signal == 0xAA || signal == 0xF1) {
            // Start update or send next part
            ESP_LOGV("ControllerOTA", "Sending part %d / %d", currentPart + 1, fileParts);
            if (!sendPart(in, size)) {
                ESP_LOGE("ControllerOTA", "Transfer aborted at part %d / %d", currentPart + 1, fileParts);
                return;
            }
            currentPart++;
            notifyUpdate();
        } else if (signal == 0xF2 || signal == 0xFF) {
            break;
        }
        delay(50);
    }
    ESP_LOGI("ControllerOTA", "Controller update finished");
}

bool ControllerOTA::sendData(uint8_t *data, uint16_t len) const {
    if (rxChar == nullptr) {
        ESP_LOGE("ControllerOTA", "RX Char uninitialized");
        return false;
    }
    // The characteristic belongs to the connection; a dropped link makes it stale, so re-check before every write.
    if (client == nullptr || !client->isConnected()) {
        ESP_LOGE("ControllerOTA", "Controller disconnected during transfer");
        return false;
    }
    if (!rxChar->writeValue(data, len, true)) {
        ESP_LOGE("ControllerOTA", "BLE write failed");
        return false;
    }
    delay(50);
    return true;
}

void ControllerOTA::fillBuffer(Stream &in, uint8_t *buffer, uint16_t len) const {
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
                    return;
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
}

void ControllerOTA::notifyUpdate() const {
    double progress = (static_cast<double>(currentPart) / static_cast<double>(fileParts)) * 50.0 + 50.0;
    progressCallback(static_cast<int>(progress));
}

bool ControllerOTA::sendPart(Stream &in, uint32_t totalSize) const {
    uint8_t partData[MTU + 2];
    uint8_t buffer[MTU];
    partData[0] = 0xFB;
    uint32_t partLength = PART_SIZE;
    if ((currentPart + 1) * PART_SIZE > totalSize) {
        partLength = totalSize - (currentPart * PART_SIZE);
    }
    uint8_t parts = partLength / MTU;
    for (uint8_t part = 0; part < parts; part++) {
        partData[1] = part;
        fillBuffer(in, buffer, MTU);
        for (uint32_t i = 0; i < MTU; i++) {
            partData[i + 2] = buffer[i];
        }
        ESP_LOGV("ControllerOTA", "Sending part %d / %d - package %d / %d", currentPart + 1, fileParts, part + 1, parts);
        if (!sendData(partData, MTU + 2))
            return false;
    }
    if (partLength % MTU > 0) {
        uint32_t remaining = partLength % MTU;
        uint8_t remainingData[remaining + 2];
        remainingData[0] = 0xFB;
        remainingData[1] = parts;
        fillBuffer(in, buffer, remaining);
        for (uint32_t i = 0; i < remaining; i++) {
            remainingData[i + 2] = buffer[i];
        }
        if (!sendData(remainingData, remaining + 2))
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
    lastSignal = pData[0];
    ESP_LOGI("ControllerOTA", "Received signal 0x%x", lastSignal);
    switch (lastSignal) {
    case 0xAA:
        ESP_LOGI("ControllerOTA", "Starting transfer, only slow mode supported as of yet");
        break;
    case 0xF1:
        ESP_LOGI("ControllerOTA", "Next part requested");
        break;
    case 0xF2:
        ESP_LOGI("ControllerOTA", "Controller installing firmware");
        break;
    default:
        ESP_LOGI("ControllerOTA", "Unhandled message");
        break;
    }
}
