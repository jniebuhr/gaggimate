#ifndef SHOT_LOG_FORMAT_H
#define SHOT_LOG_FORMAT_H

#include <stdint.h>

// Binary shot log format v1 (no backward compatibility with previous CSV)
// All values little-endian. Floats are IEEE-754 32-bit.
// File extension: .slog
// Layout:
//   Header (fixed size = 128 bytes) followed by contiguous sample records.
//   Header fields set at start; sampleCount & durationMs patched at end.
// Per-sample record fields are ALWAYS present in fixed order.
//   t(uint32_t), tt(float), ct(float), tp(float), cp(float), fl(float), tf(float), pf(float), vf(float), v(float), ev(float), pr(float)
// There are 11 float fields after t => Sample size = 4 + 11*4 = 48 bytes.

static constexpr uint32_t SHOT_LOG_MAGIC = 0x544F4853; // 'S''H''O''T' little-endian 0x54 0x4F 0x48 0x53
static constexpr uint8_t  SHOT_LOG_VERSION = 1;
static constexpr uint16_t SHOT_LOG_HEADER_SIZE = 128;
static constexpr uint16_t SHOT_LOG_SAMPLE_INTERVAL_MS = 250; // nominal recording interval
static constexpr uint32_t SHOT_LOG_FIELDS_MASK_ALL = 0x0FFF; // 12 fields present
// ShotLogSample layout: uint32_t t + 11 floats = 4 + 11*4 = 48 bytes
static constexpr uint32_t SHOT_LOG_SAMPLE_SIZE = 48;

#pragma pack(push,1)
struct ShotLogHeader {
    uint32_t magic;          // SHOT_LOG_MAGIC
    uint8_t  version;        // = SHOT_LOG_VERSION
    uint8_t  reserved0;      // stores sample size (SHOT_LOG_SAMPLE_SIZE) for diagnostics
    uint16_t headerSize;     // = SHOT_LOG_HEADER_SIZE
    uint16_t sampleInterval; // ms (nominal)
    uint16_t reserved1;      // future
    uint32_t fieldsMask;     // bitmask (currently always SHOT_LOG_FIELDS_MASK_ALL)
    uint32_t sampleCount;    // patched at end
    uint32_t durationMs;     // patched at end (last t)
    uint32_t startEpoch;     // epoch seconds
    char     profileId[32];  // null-terminated
    char     profileName[48];// null-terminated
    uint8_t  reserved[128 - 4 -1 -1 -2 -2 -2 -4 -4 -4 -4 -32 -48]; // pad to 128
};
#pragma pack(pop)

struct ShotLogSample {
    uint32_t t;   // ms since start
    float tt;     // target temp
    float ct;     // current temp
    float tp;     // target pressure
    float cp;     // current pressure
    float fl;     // current pump flow
    float tf;     // target flow
    float pf;     // puck flow
    float vf;     // BT flow
    float v;      // BT weight
    float ev;     // estimated weight
    float pr;     // puck resistance
};

static_assert(sizeof(ShotLogHeader) == SHOT_LOG_HEADER_SIZE, "ShotLogHeader size mismatch");
static_assert(sizeof(ShotLogSample) == SHOT_LOG_SAMPLE_SIZE, "ShotLogSample size mismatch");

#endif // SHOT_LOG_FORMAT_H
