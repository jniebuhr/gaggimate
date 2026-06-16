// Host shim for LittleFS.h (backed by a host directory).
#pragma once

#include "FS.h"

namespace fs {
class LittleFSFS : public FS {
  public:
    bool begin(bool formatOnFail = false, const char *basePath = "/littlefs", uint8_t maxOpenFiles = 10,
               const char *partitionLabel = "spiffs");
    void end() {}
    bool format() { return true; }
};
} // namespace fs

extern fs::LittleFSFS LittleFS;
