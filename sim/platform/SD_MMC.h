// Host shim for SD_MMC.h: no SD card in the simulator (begin() fails).
#pragma once

#include "FS.h"
#include <stdint.h>

namespace fs {
class SDMMCFS : public FS {
  public:
    bool begin(const char *mountpoint = "/sdcard", bool mode1bit = false, bool formatOnFail = false) {
        (void)mountpoint;
        (void)mode1bit;
        (void)formatOnFail;
        return false;
    }
    void end() {}
    int cardType() { return 0; }
    uint64_t cardSize() { return 0; }
    uint64_t totalBytes() { return 0; }
    uint64_t usedBytes() { return 0; }
};
} // namespace fs

extern fs::SDMMCFS SD_MMC;
