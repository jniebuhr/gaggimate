// Host shim for esp_partition.h: no partitions in the simulator.
#pragma once

#include "esp_err.h"
#include <stddef.h>
#include <stdint.h>

typedef enum { ESP_PARTITION_TYPE_APP = 0, ESP_PARTITION_TYPE_DATA = 1, ESP_PARTITION_TYPE_ANY = 0xff } esp_partition_type_t;
typedef enum { ESP_PARTITION_SUBTYPE_DATA_COREDUMP = 0x03, ESP_PARTITION_SUBTYPE_ANY = 0xff } esp_partition_subtype_t;

typedef struct {
    esp_partition_type_t type;
    esp_partition_subtype_t subtype;
    uint32_t address;
    uint32_t size;
    char label[17];
    bool encrypted;
} esp_partition_t;

static inline const esp_partition_t *esp_partition_find_first(esp_partition_type_t type, esp_partition_subtype_t subtype,
                                                              const char *label) {
    (void)type;
    (void)subtype;
    (void)label;
    return nullptr;
}
static inline esp_err_t esp_partition_read(const esp_partition_t *partition, size_t src_offset, void *dst, size_t size) {
    (void)partition;
    (void)src_offset;
    (void)dst;
    (void)size;
    return ESP_FAIL;
}
