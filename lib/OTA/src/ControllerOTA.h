#ifndef CONTROLLEROTA_H
#define CONTROLLEROTA_H

#include <Arduino.h>
#include <FS.h>
#include <OtaSender.h>
#include <functional>

constexpr char CONTROLLER_FIRMWARE_PATH[] = "/board-firmware.bin";

using ctr_progress_callback_t = std::function<void(int progress)>;

// Downloads the controller image to LittleFS (0-50 %), then hands it to the active link's OtaSender (50-100 %).
class ControllerOTA {
  public:
    ControllerOTA() = default;
    ~ControllerOTA() = default;
    void init(const ctr_progress_callback_t &progress_callback);

    bool update(OtaSender *sender, const String &release_url);

  private:
    bool downloadFile(const String &release_url);
    static bool computeMd5(File &file, uint8_t out[OtaSender::MD5_LEN]);
    bool transfer(OtaSender &sender);

    ctr_progress_callback_t progressCallback = nullptr;
};

#endif // CONTROLLEROTA_H
