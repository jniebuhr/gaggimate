// Host shim for SPIFFS.h (backed by a host directory).
#pragma once

#include "FS.h"

namespace fs {
class SPIFFSFS : public FS {
  public:
    bool begin(bool formatOnFail = false, const char *basePath = "/spiffs", uint8_t maxOpenFiles = 10,
               const char *partitionLabel = nullptr);
    void end() {}
    bool format() { return true; }
};
} // namespace fs

extern fs::SPIFFSFS SPIFFS;
