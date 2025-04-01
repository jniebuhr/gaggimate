#include "ControllerOTA.h"
#include <SPIFFS.h>
#include <HTTPClient.h>

void ControllerOTA::init(NimBLEClient *client, const ctr_progress_callback_t &progress_callback) {
    this->client = client;
    progressCallback = progress_callback;
    NimBLERemoteService *pRemoteService = client->getService(NimBLEUUID(SERVICE_OTA_BLE_UUID));
    rxChar = pRemoteService->getCharacteristic(NimBLEUUID(CHARACTERISTIC_OTA_BL_UUID_RX));
    txChar = pRemoteService->getCharacteristic(NimBLEUUID(CHARACTERISTIC_OTA_BL_UUID_TX));
    if (txChar->canNotify()) {
        txChar->subscribe(true, std::bind(&ControllerOTA::onReceive, this, std::placeholders::_1, std::placeholders::_2,
                                          std::placeholders::_3, std::placeholders::_4));
    }

}

void ControllerOTA::update(WiFiClientSecure &wifi_client, const String &release_url) {
    if (SPIFFS.exists("/board-firmware.bin")) {
        ESP_LOGI("ControllerOTA", "Removing previous update file");
        SPIFFS.remove("/board-firmware.bin");
    }
    if (!downloadFile(wifi_client, release_url)) {
        ESP_LOGE("ControllerOTA", "Download of firmware file failed");
    }
    File file = SPIFFS.open("/board-firmware.bin", FILE_READ);
    runUpdate(file, file.size());
    file.close();
}

bool ControllerOTA::downloadFile(WiFiClientSecure &wifi_client, const String &release_url) {
    HTTPClient http;
    if (!http.begin(wifi_client, release_url)) {
        ESP_LOGE("ControllerOTA", "Failed to start http client");
        return false;
    }

    http.useHTTP10(true);
    http.setTimeout(1800);
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

    File file = SPIFFS.open("/board-firmware.bin", FILE_WRITE, true);

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
    sendData(fileLengthBytes, 5);
    uint8_t partsAndMTU[] = {
        0xFF,
        static_cast<uint8_t>(fileParts / 256),
        static_cast<uint8_t>(fileParts % 256),
        static_cast<uint8_t>(MTU / 256),
        static_cast<uint8_t>(MTU % 256),
    };
    sendData(partsAndMTU, 5);
    uint8_t updateStart[] = {0xFD};
    sendData(updateStart, 1);
    ESP_LOGI("ControllerOTA", "Waiting for signal from controller");

    while (client->isConnected()) {
        uint8_t signal = lastSignal;
        lastSignal = 0x00;
        if (signal == 0xAA || signal == 0xF1) {
            // Start update or send next part
            ESP_LOGI("ControllerOTA", "Sending part %d / %d", currentPart + 1, fileParts);
            sendPart(in, size);
            currentPart++;
            notifyUpdate();
        } else if (signal == 0xF2 || signal == 0xFF) {
            break;
        }
        delay(50);
    }
    ESP_LOGI("ControllerOTA", "Controller update finished");
}

void ControllerOTA::sendData(uint8_t *data, uint16_t len) const {
    if (rxChar == nullptr) {
        ESP_LOGI("ControllerOTA", "RX Char uninitialized");
        return;
    }
    rxChar->writeValue(data, len, true);
    delay(50);
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

void ControllerOTA::sendPart(Stream &in, uint32_t totalSize) const {
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
        ESP_LOGI("ControllerOTA", "Sending part %d / %d - package %d / %d", currentPart + 1, fileParts, part + 1, parts);
        sendData(partData, MTU + 2);
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
        sendData(remainingData, remaining + 2);
    }
    uint8_t footer[5];
    footer[0] = 0xFC;
    footer[1] = partLength / 256;
    footer[2] = partLength % 256;
    footer[3] = currentPart / 256;
    footer[4] = currentPart % 256;
    sendData(footer, sizeof(footer));
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
