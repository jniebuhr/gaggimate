#ifndef PROFILEIMAGE_H
#define PROFILEIMAGE_H

#include <Arduino.h>

// Profile images on the SD card: a 4-byte LVGL image header + 300x300 RGB565 (little endian), converted in the web UI.
namespace profile_image {

constexpr uint32_t SIZE = 300;
constexpr uint32_t COLOR_FORMAT = 4; // LV_IMG_CF_TRUE_COLOR
constexpr uint32_t HEADER = COLOR_FORMAT | (SIZE << 10) | (SIZE << 21);
constexpr size_t HEADER_BYTES = 4;
constexpr size_t FILE_BYTES = HEADER_BYTES + SIZE * SIZE * 2;
constexpr const char *DIR = "/pi";

// Profile ids are UUIDs; anything else could escape the image directory.
inline bool isValidId(const String &id) {
    if (id.isEmpty() || id.length() > 64)
        return false;
    for (size_t i = 0; i < id.length(); i++) {
        const char c = id.charAt(i);
        if (!isalnum(static_cast<unsigned char>(c)) && c != '-' && c != '_')
            return false;
    }
    return true;
}

inline String path(const String &id) { return String(DIR) + "/" + id + ".bin"; }

} // namespace profile_image

#endif // PROFILEIMAGE_H
