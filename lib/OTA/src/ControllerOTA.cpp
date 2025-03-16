#include "ControllerOTA.h"

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
    HTTPClient http;
    if (!http.begin(wifi_client, release_url)) {
        printf("Failed to start http client\n");
        return;
    }

    http.useHTTP10(true);
    http.setTimeout(1800);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.setUserAgent("ESP32-http-Update");
    http.addHeader("Cache-Control", "no-cache");
    int code = http.GET();
    int len = http.getSize();

    if (code != HTTP_CODE_OK) {
        log_e("HTTP error: %d\n", code);
        http.end();
        return;
    }

    if (len == 0) {
        printf("Could not fetch firmware\n");
        http.end();
        return;
    }

    int sketchFreeSpace = ESP.getFreeSketchSpace();
    if (!sketchFreeSpace) {
        printf("No free sketch space\n");
        return;
    }

    if (len > sketchFreeSpace) {
        log_e("FreeSketchSpace to low (%d) needed: %d\n", sketchFreeSpace, len);
        return;
    }

    WiFiClient *tcp = http.getStreamPtr();
    delay(100);

    if (tcp->peek() != 0xE9) {
        log_e("Magic header does not start with 0xE9\n");
        http.end();
        return;
    }
    runUpdate(*tcp, len);
    http.end();
}

void ControllerOTA::runUpdate(Stream &in, uint32_t size) {
    printf("Sending update instructions over BLE. File Size: %d\n", size);
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
    printf("Waiting for signal from controller\n");

    while (client->isConnected()) {
        uint8_t signal = lastSignal;
        lastSignal = 0x00;
        if (signal == 0xAA || signal == 0xF1) {
            // Start update or send next part
            printf("Sending part %d / %d\n", currentPart + 1, fileParts);
            sendPart(in, size);
            currentPart++;
            notifyUpdate();
        } else if (signal == 0xF2 || signal == 0xFF) {
            break;
        }
        delay(100);
    }
    printf("Controller update finished\n");
}

void ControllerOTA::sendData(uint8_t *data, uint16_t len) const {
    if (rxChar == nullptr) {
        printf("RX Char uninitialized\n");
        return;
    }
    rxChar->writeValue(data, len, true);
    delay(10);
}

void ControllerOTA::notifyUpdate() const {
    double progress = (static_cast<double>(currentPart) / static_cast<double>(fileParts)) * 100.0;
    progressCallback(static_cast<int>(progress));
}

void ControllerOTA::sendPart(Stream &in, uint32_t totalSize) const {
    uint8_t partData[MTU + 2];
    partData[0] = 0xFB;
    uint32_t partLength = PART_SIZE;
    if ((currentPart + 1) * PART_SIZE > totalSize) {
        partLength = totalSize - (currentPart * PART_SIZE);
    }
    uint8_t parts = partLength / MTU;
    for (uint8_t part = 0; part < parts; part++) {
        partData[1] = part;
        for (uint32_t i = 0; i < MTU; i++) {
            partData[i + 2] = (uint8_t)in.read();
        }
        printf("Sending part %d / %d - package %d / %d\n", currentPart + 1, fileParts, part + 1, parts);
        sendData(partData, MTU + 2);
    }
    if (partLength % MTU > 0) {
        uint32_t remaining = partLength % MTU;
        uint8_t remainingData[remaining + 2];
        remainingData[0] = 0xFB;
        remainingData[1] = parts;
        for (uint32_t i = 0; i < remaining; i++) {
            remainingData[i + 2] = (uint8_t)in.read();
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
    printf("Received signal 0x%x\n", lastSignal);
    switch (lastSignal) {
    case 0xAA:
        printf("Starting transfer, only slow mode supported as of yet\n");
        break;
    case 0xF1:
        printf("Next part requested\n");
        break;
    case 0xF2:
        printf("Controller installing firmware\n");
        break;
    default:
        printf("Unhandled message\n");
        break;
    }
}
