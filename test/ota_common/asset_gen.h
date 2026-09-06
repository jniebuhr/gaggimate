// Deterministic asset bytes shared with chaos_server.py: xorshift32 seeded from (name, version, size).
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

inline uint32_t assetFnv1a(const std::string &s) {
    uint32_t h = 2166136261u;
    for (unsigned char c : s) {
        h ^= c;
        h *= 16777619u;
    }
    return h;
}

inline std::vector<uint8_t> generateAsset(const std::string &name, uint32_t version, size_t size) {
    uint32_t state = assetFnv1a(name) ^ (version * 0x9E3779B1u) ^ static_cast<uint32_t>(size);
    if (state == 0) {
        state = 1;
    }
    std::vector<uint8_t> out(size);
    size_t i = 0;
    while (i < size) {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        for (int b = 0; b < 4 && i < size; b++, i++) {
            out[i] = static_cast<uint8_t>((state >> (8 * b)) & 0xFF);
        }
    }
    return out;
}
