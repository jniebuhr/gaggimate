// Host shim for esp_log.h: ESP_LOG* print to stderr.
#pragma once

#include <stdio.h>

typedef enum { ESP_LOG_NONE, ESP_LOG_ERROR, ESP_LOG_WARN, ESP_LOG_INFO, ESP_LOG_DEBUG, ESP_LOG_VERBOSE } esp_log_level_t;

// The firmware's tag is sometimes an Arduino String (e.g. a static LOG_TAG), so
// don't feed it to printf %s — drop the tag and just print the message.
#define ESP_LOGE(tag, fmt, ...)                                                                                                  \
    do {                                                                                                                         \
        (void)(tag);                                                                                                             \
        fprintf(stderr, "[E] " fmt "\n", ##__VA_ARGS__);                                                                         \
    } while (0)
#define ESP_LOGW(tag, fmt, ...)                                                                                                  \
    do {                                                                                                                         \
        (void)(tag);                                                                                                             \
        fprintf(stderr, "[W] " fmt "\n", ##__VA_ARGS__);                                                                         \
    } while (0)
#define ESP_LOGI(tag, fmt, ...)                                                                                                  \
    do {                                                                                                                         \
        (void)(tag);                                                                                                             \
        fprintf(stderr, "[I] " fmt "\n", ##__VA_ARGS__);                                                                         \
    } while (0)
#define ESP_LOGD(tag, fmt, ...) ((void)0)
#define ESP_LOGV(tag, fmt, ...) ((void)0)

static inline void esp_log_level_set(const char *tag, esp_log_level_t level) {
    (void)tag;
    (void)level;
}
