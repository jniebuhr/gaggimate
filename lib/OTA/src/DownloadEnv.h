#ifndef OTA_DOWNLOAD_ENV_H
#define OTA_DOWNLOAD_ENV_H

#include <cstddef>
#include <cstdint>

// Platform hooks the downloader needs; the firmware maps them to FreeRTOS, esp_wifi and heap_caps.
class DownloadEnv {
  public:
    virtual ~DownloadEnv() = default;
    virtual void delayMs(uint32_t ms) = 0;
    // Blocks until the station link is up or maxWaitMs passed; true when the link is up.
    virtual bool waitForNetwork(uint32_t maxWaitMs) = 0;
    // The buffer is the source of flash writes, so the firmware must hand out internal DRAM.
    virtual uint8_t *allocBuffer(size_t size) = 0;
    virtual void freeBuffer(uint8_t *buffer) = 0;
};

#endif // OTA_DOWNLOAD_ENV_H
