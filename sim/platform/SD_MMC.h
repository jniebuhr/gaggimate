// Host shim for SD_MMC.h. The simulator has no SD card by default (begin() fails), like a
// panel without a card. Set GAGGIMATE_SIM_SD=1 to back it with sim_data/sdcard so SD-only
// features (profile images, history on SD) can be exercised.
#pragma once

#include "FS.h"
#include <stdint.h>

namespace fs {
class SDMMCFS : public FS {
  public:
    bool begin(const char *mountpoint = "/sdcard", bool mode1bit = false, bool formatOnFail = false, int freq = 0,
               uint8_t maxOpenFiles = 5);
    void end() {}
    int cardType() { return _mounted ? 2 : 0; }
    uint64_t cardSize() { return _mounted ? 32ULL * 1024 * 1024 * 1024 : 0; }
    uint64_t totalBytes() { return cardSize(); }
    uint64_t usedBytes() { return _mounted ? 64ULL * 1024 * 1024 : 0; }

  private:
    bool _mounted = false;
};
} // namespace fs

extern fs::SDMMCFS SD_MMC;
