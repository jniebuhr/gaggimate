#include "SdImageDecoder.h"

#include <atomic>
#include <cstring>
#include <esp32-hal-psram.h>
#include <lvgl.h>
#include <string>

// Only one profile image is on screen at a time, so a single slot is enough.
static std::string cachedPath;
static lv_img_header_t cachedHeader;
static uint8_t *cachedData = nullptr;
static std::atomic<bool> invalidatePending{false};

static void dropCache() {
    free(cachedData);
    cachedData = nullptr;
    cachedPath.clear();
}

static bool isSdImage(const void *src) {
    if (lv_img_src_get_type(src) != LV_IMG_SRC_FILE)
        return false;
    const auto *path = static_cast<const char *>(src);
    return strncmp(path, "S:", 2) == 0 && strcmp(lv_fs_get_ext(path), "bin") == 0;
}

static bool load(const char *path) {
    if (cachedData != nullptr && cachedPath == path)
        return true;
    dropCache();

    lv_fs_file_t f;
    if (lv_fs_open(&f, path, LV_FS_MODE_RD) != LV_FS_RES_OK)
        return false;
    lv_img_header_t header;
    uint32_t read = 0;
    bool ok = lv_fs_read(&f, &header, sizeof(header), &read) == LV_FS_RES_OK && read == sizeof(header) &&
              header.cf == LV_IMG_CF_TRUE_COLOR && header.w > 0 && header.h > 0;
    const uint32_t size = ok ? header.w * header.h * sizeof(lv_color_t) : 0;
    auto *data = ok ? static_cast<uint8_t *>(ps_malloc(size)) : nullptr;
    ok = data != nullptr && lv_fs_read(&f, data, size, &read) == LV_FS_RES_OK && read == size;
    lv_fs_close(&f);
    if (!ok) {
        free(data);
        return false;
    }
    cachedPath = path;
    cachedHeader = header;
    cachedData = data;
    return true;
}

static lv_res_t infoCb(lv_img_decoder_t *, const void *src, lv_img_header_t *header) {
    if (!isSdImage(src) || !load(static_cast<const char *>(src)))
        return LV_RES_INV;
    *header = cachedHeader;
    return LV_RES_OK;
}

static lv_res_t openCb(lv_img_decoder_t *, lv_img_decoder_dsc_t *dsc) {
    if (!isSdImage(dsc->src) || !load(static_cast<const char *>(dsc->src)))
        return LV_RES_INV;
    dsc->img_data = cachedData;
    return LV_RES_OK;
}

static void closeCb(lv_img_decoder_t *, lv_img_decoder_dsc_t *) {}

void sdImageDecoderInit() {
    lv_img_decoder_t *decoder = lv_img_decoder_create(); // inserted at the head, so it runs before the built-in decoder
    lv_img_decoder_set_info_cb(decoder, infoCb);
    lv_img_decoder_set_open_cb(decoder, openCb);
    lv_img_decoder_set_close_cb(decoder, closeCb);
}

void sdImageInvalidate() { invalidatePending = true; }

bool sdImageProcessInvalidation() {
    if (!invalidatePending.exchange(false))
        return false;
    dropCache();
    return true;
}
