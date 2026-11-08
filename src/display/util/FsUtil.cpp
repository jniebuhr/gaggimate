#include "FsUtil.h"
#include <Arduino.h>
#include <esp32-hal-psram.h>
#include <esp_log.h>

namespace fs_util {

namespace {

constexpr const char *LOG_TAG = "FsUtil";
constexpr size_t COPY_CHUNK = 4096;

String baseName(const String &path) { return path.substring(path.lastIndexOf('/') + 1); }

String joinPath(const String &dir, const String &name) { return dir.endsWith("/") ? dir + name : dir + "/" + name; }

bool copyFile(fs::FS &src, fs::FS &dst, const String &path, uint8_t *buf) {
    File in = src.open(path, "r");
    if (!in)
        return false;
    File out = dst.open(path, "w");
    if (!out) {
        in.close();
        return false;
    }
    bool ok = true;
    size_t n;
    while ((n = in.read(buf, COPY_CHUNK)) > 0) {
        if (out.write(buf, n) != n) {
            ok = false;
            break;
        }
    }
    out.close();
    in.close();
    return ok;
}

bool copyDir(fs::FS &src, fs::FS &dst, const String &dir, uint8_t *buf) {
    File root = src.open(dir);
    if (!root || !root.isDirectory()) {
        if (root)
            root.close();
        return false;
    }
    if (dir != "/" && !dst.exists(dir) && !dst.mkdir(dir)) {
        root.close();
        return false;
    }
    // Names only: openNextFile() would fopen every entry against the 10-file SD_MMC limit.
    bool ok = true;
    bool isDir = false;
    for (String name = root.getNextFileName(&isDir); !name.isEmpty(); name = root.getNextFileName(&isDir)) {
        if (isHiddenPath(name))
            continue;
        const String path = joinPath(dir, baseName(name));
        if (!(isDir ? copyDir(src, dst, path, buf) : copyFile(src, dst, path, buf))) {
            ESP_LOGE(LOG_TAG, "Failed to copy %s", path.c_str());
            ok = false;
        }
        delay(1); // keep the idle task fed on large shot histories
    }
    root.close();
    return ok;
}

} // namespace

bool isHiddenPath(const String &path) { return baseName(path).startsWith("."); }

bool isEmptyVolume(fs::FS &fs) {
    File root = fs.open("/");
    if (!root || !root.isDirectory()) {
        if (root)
            root.close();
        return false;
    }
    bool empty = true;
    for (String name = root.getNextFileName(); !name.isEmpty(); name = root.getNextFileName()) {
        if (!isHiddenPath(name) && baseName(name) != "System Volume Information") {
            empty = false;
            break;
        }
    }
    root.close();
    return empty;
}

bool copyTree(fs::FS &src, fs::FS &dst, const String &dir) {
    auto *buf = static_cast<uint8_t *>(ps_malloc(COPY_CHUNK));
    if (buf == nullptr)
        return false;
    const bool ok = copyDir(src, dst, dir, buf);
    free(buf);
    return ok;
}

} // namespace fs_util
