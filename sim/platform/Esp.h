// Host shim for the Arduino EspClass singleton (ESP.*).
#pragma once

#include <cstdint>
#include <cstdlib>

class EspClass {
  public:
    void restart() { exit(0); }
    uint32_t getFreeHeap() { return 4u * 1024u * 1024u; }
    uint32_t getMinFreeHeap() { return 2u * 1024u * 1024u; }
    uint32_t getMaxAllocHeap() { return 2u * 1024u * 1024u; }
    uint32_t getHeapSize() { return 8u * 1024u * 1024u; }
    uint32_t getFreePsram() { return 7u * 1024u * 1024u; }
    uint32_t getPsramSize() { return 8u * 1024u * 1024u; }
    uint8_t getChipRevision() { return 1; }
    const char *getChipModel() { return "ESP32-SIM"; }
    uint8_t getChipCores() { return 2; }
    uint32_t getCpuFreqMHz() { return 240; }
    uint64_t getEfuseMac() { return 0x001122334455ULL; }
    const char *getSdkVersion() { return "sim"; }
    uint32_t getFlashChipSize() { return 16u * 1024u * 1024u; }
};

extern EspClass ESP;
