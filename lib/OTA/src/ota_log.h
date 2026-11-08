#ifndef OTA_LOG_H
#define OTA_LOG_H

// ESP_LOGx on the device; printf with a compile-time level on the host so the core stays testable natively.
#ifdef ESP_PLATFORM
#include <esp_log.h>
#define OTA_LOGE(tag, ...) ESP_LOGE(tag, __VA_ARGS__)
#define OTA_LOGW(tag, ...) ESP_LOGW(tag, __VA_ARGS__)
#define OTA_LOGI(tag, ...) ESP_LOGI(tag, __VA_ARGS__)
#else
#include <cstdio>
#ifndef OTA_LOG_LEVEL
#define OTA_LOG_LEVEL 3 // 1 = errors, 2 = warnings, 3 = info
#endif
#define OTA_LOG_PRINT(level, tag, fmt, ...) std::printf("[%s] %s: " fmt "\n", level, tag, ##__VA_ARGS__)
#define OTA_LOGE(tag, ...) OTA_LOG_PRINT("E", tag, __VA_ARGS__)
#if OTA_LOG_LEVEL >= 2
#define OTA_LOGW(tag, ...) OTA_LOG_PRINT("W", tag, __VA_ARGS__)
#else
#define OTA_LOGW(tag, ...) ((void)0)
#endif
#if OTA_LOG_LEVEL >= 3
#define OTA_LOGI(tag, ...) OTA_LOG_PRINT("I", tag, __VA_ARGS__)
#else
#define OTA_LOGI(tag, ...) ((void)0)
#endif
#endif

#endif // OTA_LOG_H
