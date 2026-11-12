#include "BleOtaSender.h"
#include <esp_log.h>

bool BleOtaSender::isLinkUp() const {
    NimBLEClient *client = _transport.getNativeClient();
    return client != nullptr && client->isConnected();
}

bool BleOtaSender::resolveCharacteristics() {
    _rxChar = nullptr;
    _txChar = nullptr;
    if (_client == nullptr || !_client->isConnected()) {
        ESP_LOGE(LOG_TAG, "No BLE connection to the controller");
        return false;
    }
    NimBLERemoteService *service = _client->getService(NimBLEUUID(gm_ble_ota::SERVICE_UUID));
    if (service == nullptr) {
        ESP_LOGE(LOG_TAG, "OTA BLE service not found");
        return false;
    }
    NimBLERemoteCharacteristic *rx = service->getCharacteristic(NimBLEUUID(gm_ble_ota::RX_CHAR_UUID));
    NimBLERemoteCharacteristic *tx = service->getCharacteristic(NimBLEUUID(gm_ble_ota::TX_CHAR_UUID));
    if (rx == nullptr || tx == nullptr) {
        ESP_LOGE(LOG_TAG, "OTA BLE characteristics not found");
        return false;
    }
    if (!tx->canNotify() ||
        !tx->subscribe(true, std::bind(&BleOtaSender::onReceive, this, std::placeholders::_1, std::placeholders::_2,
                                       std::placeholders::_3, std::placeholders::_4))) {
        ESP_LOGE(LOG_TAG, "Failed to subscribe to the OTA notification characteristic");
        return false;
    }
    _rxChar = rx;
    _txChar = tx;
    _lastSignal = 0x00;
    return true;
}

bool BleOtaSender::run(uint32_t size, const uint8_t md5[MD5_LEN], const ReadFn &read, const ProgressFn &progress) {
    (void)md5; // the DFU service checks every part with its own CRC
    _client = _transport.getNativeClient();
    if (size == 0 || !resolveCharacteristics()) {
        ESP_LOGE(LOG_TAG, "Could not reach the controller OTA service, aborting");
        return false;
    }
    // Below DEFAULT_MTU the one-byte packet index overflows a part (and 0 means the link is gone), so never go lower.
    const uint16_t attMtu = _client->getMTU();
    _currentMtu = attMtu > DEFAULT_MTU + STACK_MTU_OFFSET ? attMtu - STACK_MTU_OFFSET : DEFAULT_MTU;
    if (_currentMtu > MAX_MTU)
        _currentMtu = MAX_MTU;
    ESP_LOGI(LOG_TAG, "ATT MTU %u, sending %u byte packets", attMtu, _currentMtu);
    const bool ok = transfer(size, read, progress);
    // Drop the pointers again; the next update re-resolves them against the live connection.
    _rxChar = nullptr;
    _txChar = nullptr;
    return ok;
}

bool BleOtaSender::transfer(uint32_t size, const ReadFn &read, const ProgressFn &progress) {
    ESP_LOGI(LOG_TAG, "Sending update instructions over BLE. File Size: %u", static_cast<unsigned>(size));
    _fileParts = (size + PART_SIZE - 1) / PART_SIZE;
    _currentPart = 0;
    _offset = 0;

    uint8_t fileLengthBytes[] = {
        0xFE,
        static_cast<uint8_t>((size >> 24) & 0xFF),
        static_cast<uint8_t>((size >> 16) & 0xFF),
        static_cast<uint8_t>((size >> 8) & 0xFF),
        static_cast<uint8_t>(size & 0xFF),
    };
    uint8_t partsAndMTU[] = {
        0xFF,
        static_cast<uint8_t>(_fileParts / 256),
        static_cast<uint8_t>(_fileParts % 256),
        static_cast<uint8_t>(_currentMtu / 256),
        static_cast<uint8_t>(_currentMtu % 256),
    };
    uint8_t updateStart[] = {0xFD};
    _lastSignal = 0x00;
    _fastMode = false;
    if (!sendData(fileLengthBytes, 5) || !sendData(partsAndMTU, 5) || !sendData(updateStart, 1)) {
        ESP_LOGE(LOG_TAG, "Failed to send update instructions, aborting");
        return false;
    }
    ESP_LOGI(LOG_TAG, "Waiting for signal from controller");
    if (waitForSignal() != 0xAA) {
        ESP_LOGE(LOG_TAG, "Controller did not start the transfer, aborting");
        return false;
    }
    ESP_LOGI(LOG_TAG, "Starting transfer in %s mode", _fastMode ? "fast" : "slow");

    const uint32_t startedAt = millis();
    progress(0, size);
    while (_currentPart < _fileParts) {
        _lastSignal = 0x00;
        ESP_LOGV(LOG_TAG, "Sending part %u / %u", static_cast<unsigned>(_currentPart + 1), static_cast<unsigned>(_fileParts));
        if (!sendPart(size, read)) {
            ESP_LOGE(LOG_TAG, "Transfer aborted at part %u / %u", static_cast<unsigned>(_currentPart + 1),
                     static_cast<unsigned>(_fileParts));
            return false;
        }
        _currentPart++;
        progress(_offset, size);
        if (_lastSignal == 0x0F) {
            ESP_LOGE(LOG_TAG, "Controller rejected part %u / %u, aborting", static_cast<unsigned>(_currentPart),
                     static_cast<unsigned>(_fileParts));
            return false;
        }
        // Fast mode streams on; the acknowledged 0xFC write already holds us back until the part is flashed.
        if (_currentPart < _fileParts && !_fastMode && waitForSignal() != 0xF1) {
            ESP_LOGE(LOG_TAG, "Controller did not request part %u / %u, aborting", static_cast<unsigned>(_currentPart + 1),
                     static_cast<unsigned>(_fileParts));
            return false;
        }
    }
    ESP_LOGI(LOG_TAG, "Sent %u bytes in %u ms", static_cast<unsigned>(size), static_cast<unsigned>(millis() - startedAt));

    const uint8_t signal = waitForSignal();
    if (signal == 0xF2 || signal == 0xFF) {
        ESP_LOGI(LOG_TAG, "Controller update finished");
        return true;
    }
    ESP_LOGE(LOG_TAG, "Controller did not confirm the update (signal 0x%x)", signal);
    return false;
}

uint8_t BleOtaSender::waitForSignal() {
    const uint32_t start = millis();
    while (_client->isConnected() && millis() - start < SIGNAL_TIMEOUT_MS) {
        const uint8_t signal = _lastSignal;
        if (signal != 0x00) {
            _lastSignal = 0x00;
            return signal;
        }
        delay(SIGNAL_POLL_MS);
    }
    if (_client->isConnected())
        ESP_LOGE(LOG_TAG, "No signal from the controller for %u ms", static_cast<unsigned>(SIGNAL_TIMEOUT_MS));
    else
        ESP_LOGE(LOG_TAG, "Controller disconnected");
    return 0x00;
}

bool BleOtaSender::sendData(uint8_t *data, uint16_t len, bool response) const {
    if (_rxChar == nullptr) {
        ESP_LOGE(LOG_TAG, "RX Char uninitialized");
        return false;
    }
    // The characteristic belongs to the connection; a dropped link makes it stale, so re-check before every write.
    if (_client == nullptr || !_client->isConnected()) {
        ESP_LOGE(LOG_TAG, "Controller disconnected during transfer");
        return false;
    }
    // Hold no-response packets back while the shared TX pool runs low; leaves room for 0xFC, pings and scale writes.
    const uint32_t start = millis();
    while (!response && os_msys_num_free() < MIN_FREE_TX_BUFFERS && _client->isConnected() &&
           millis() - start < WRITE_RETRIES * WRITE_RETRY_BACKOFF_MS)
        delay(TX_BUFFER_POLL_MS);

    for (uint16_t attempt = 0; attempt < WRITE_RETRIES; attempt++) {
        if (_rxChar->writeValue(data, len, response))
            return true;
        if (!_client->isConnected())
            break;
        delay(WRITE_RETRY_BACKOFF_MS);
    }
    ESP_LOGE(LOG_TAG, "BLE write failed");
    return false;
}

bool BleOtaSender::sendPacket(uint8_t index, uint16_t len, const ReadFn &read) {
    uint8_t packet[MAX_MTU + 2];
    packet[0] = 0xFB;
    packet[1] = index;
    if (read(_offset, packet + 2, len) != len) {
        ESP_LOGE(LOG_TAG, "Could not read image at offset %u", static_cast<unsigned>(_offset));
        return false;
    }
    if (!sendData(packet, len + 2, false))
        return false;
    _offset += len;
    return true;
}

bool BleOtaSender::sendPart(uint32_t totalSize, const ReadFn &read) {
    uint32_t partLength = PART_SIZE;
    if ((_currentPart + 1) * PART_SIZE > totalSize)
        partLength = totalSize - (_currentPart * PART_SIZE);
    const uint8_t packets = partLength / _currentMtu;
    for (uint8_t packet = 0; packet < packets; packet++) {
        if (!sendPacket(packet, _currentMtu, read))
            return false;
    }
    if (partLength % _currentMtu > 0 && !sendPacket(packets, partLength % _currentMtu, read))
        return false;
    uint8_t footer[5];
    footer[0] = 0xFC;
    footer[1] = partLength / 256;
    footer[2] = partLength % 256;
    footer[3] = _currentPart / 256;
    footer[4] = _currentPart % 256;
    return sendData(footer, sizeof(footer));
}

void BleOtaSender::onReceive(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length, bool isNotify) {
    (void)characteristic;
    (void)isNotify;
    if (length == 0)
        return;
    // Publish the mode before the signal; the calling task reads _fastMode once it sees 0xAA.
    if (data[0] == 0xAA)
        _fastMode = length > 1 && data[1] != 0;
    _lastSignal = data[0];
    switch (data[0]) {
    case 0xAA:
        ESP_LOGI(LOG_TAG, "Starting transfer, controller requests %s mode", _fastMode ? "fast" : "slow");
        break;
    case 0xF1:
        ESP_LOGI(LOG_TAG, "Next part requested");
        break;
    case 0xF2:
        ESP_LOGI(LOG_TAG, "Controller installing firmware");
        break;
    case 0x0F:
        ESP_LOGE(LOG_TAG, "Controller reported an error: %.*s", static_cast<int>(length - 1), data + 1);
        break;
    default:
        ESP_LOGI(LOG_TAG, "Unhandled signal 0x%x", data[0]);
        break;
    }
}
