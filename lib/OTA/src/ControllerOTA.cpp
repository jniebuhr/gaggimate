#include "ControllerOTA.h"
#include "EspHttpTransport.h"
#include "ResumableDownloader.h"
#include <LittleFS.h>
#include <MD5Builder.h>
#include <esp_app_format.h>

void ControllerOTA::init(const ctr_progress_callback_t &progress_callback) {
    ESP_LOGI("ControllerOTA", "Initializing ControllerOTA");
    progressCallback = progress_callback;
}

bool ControllerOTA::update(OtaSender *sender, const String &release_url) {
    // Fail before the download
    if (sender == nullptr || !sender->isLinkUp()) {
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
    return transfer(*sender);
}

bool ControllerOTA::downloadFile(const String &release_url) {
    File file = LittleFS.open(CONTROLLER_FIRMWARE_PATH, FILE_WRITE, true);
    if (!file) {
        ESP_LOGE("ControllerOTA", "Could not create %s", CONTROLLER_FIRMWARE_PATH);
        return false;
    }
    DownloadSink sink;
    sink.write = [&file](const uint8_t *data, size_t len) {
        if (file.position() == 0 && data[0] != ESP_IMAGE_HEADER_MAGIC) {
            ESP_LOGE("ControllerOTA", "Magic header does not start with 0xE9");
            return false;
        }
        return file.write(data, len) == len;
    };
    sink.restart = [&file]() {
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

bool ControllerOTA::computeMd5(File &file, uint8_t out[OtaSender::MD5_LEN]) {
    MD5Builder md5;
    md5.begin();
    file.seek(0);
    uint8_t buf[512];
    size_t total = 0;
    while (file.available()) {
        const size_t n = file.read(buf, sizeof(buf));
        if (n == 0)
            break;
        md5.add(buf, n);
        total += n;
    }
    md5.calculate();
    md5.getBytes(out);
    file.seek(0);
    return total == file.size();
}

bool ControllerOTA::transfer(OtaSender &sender) {
    File file = LittleFS.open(CONTROLLER_FIRMWARE_PATH, FILE_READ);
    if (!file) {
        ESP_LOGE("ControllerOTA", "Could not open the downloaded firmware file");
        return false;
    }
    const uint32_t size = file.size();
    uint8_t md5[OtaSender::MD5_LEN];
    if (!computeMd5(file, md5)) {
        ESP_LOGE("ControllerOTA", "Could not read back the downloaded firmware file");
        file.close();
        return false;
    }
    ESP_LOGI("ControllerOTA", "Sending %u byte image to the controller", static_cast<unsigned>(size));
    const bool ok = sender.run(
        size, md5,
        [&file](uint32_t offset, uint8_t *buf, size_t len) -> size_t {
            if (file.position() != offset && !file.seek(offset))
                return 0;
            return file.read(buf, len);
        },
        [this](uint32_t sent, uint32_t total) {
            progressCallback(50 + static_cast<int>((static_cast<uint64_t>(sent) * 50) / total));
        });
    file.close();
    return ok;
}
