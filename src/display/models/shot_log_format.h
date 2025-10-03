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
//   tick(uint16_t), tt(uint16_t), ct(uint16_t), tp(uint16_t), cp(uint16_t), fl(int16_t), tf(int16_t), pf(int16_t), vf(int16_t), v(uint16_t), ev(uint16_t), pr(uint16_t)
// Values are stored as scaled integers (see comments per field below).
// Sample size = 12 fields * 2 bytes = 24 bytes.

static constexpr uint32_t SHOT_LOG_MAGIC = 0x544F4853; // 'S''H''O''T' little-endian 0x54 0x4F 0x48 0x53
static constexpr uint8_t  SHOT_LOG_VERSION = 1;
static constexpr uint16_t SHOT_LOG_HEADER_SIZE = 128;
static constexpr uint16_t SHOT_LOG_SAMPLE_INTERVAL_MS = 250; // nominal recording interval
static constexpr uint32_t SHOT_LOG_FIELDS_MASK_ALL = 0x0FFF; // 12 fields present

static constexpr uint32_t SHOT_LOG_SAMPLE_SIZE = 24;

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
    uint16_t finalWeight;    // final beverage weight (g * 10)
    uint8_t  reserved[128 - 4 -1 -1 -2 -2 -2 -4 -4 -4 -4 -32 -48 -2]; // pad to 128
};
#pragma pack(pop)

// Scaled values:
//   tick: sample index (0.25 s steps) -> milliseconds = tick * SHOT_LOG_SAMPLE_INTERVAL_MS
//   tt / ct: temperature in °C * 10 (0.1 °C resolution)
//   tp / cp: pressure in bar * 10 (0.1 bar resolution)
//   fl / tf / pf / vf: flow in ml/s * 100 (0.01 ml/s resolution)
//   v / ev: weight in g * 10 (0.1 g resolution)
//   pr: puck resistance * 100 (0.01 step, saturates at uint16_t max)
struct ShotLogSample {
    uint16_t t;   // sample index (0.25 s ticks)
    uint16_t tt;  // target temp * 10
    uint16_t ct;  // current temp * 10
    uint16_t tp;  // target pressure * 10
    uint16_t cp;  // current pressure * 10
    int16_t  fl;  // current pump flow * 100 (allows small negatives)
    int16_t  tf;  // target flow * 100
    int16_t  pf;  // puck flow * 100
    int16_t  vf;  // bluetooth flow * 100
    uint16_t v;   // bluetooth weight * 10
    uint16_t ev;  // estimated weight * 10
    uint16_t pr;  // puck resistance * 100
};

static_assert(sizeof(ShotLogHeader) == SHOT_LOG_HEADER_SIZE, "ShotLogHeader size mismatch");
static_assert(sizeof(ShotLogSample) == SHOT_LOG_SAMPLE_SIZE, "ShotLogSample size mismatch");

// Binary shot index format
// File: /h/index.bin
// Layout: ShotIndexHeader followed by contiguous ShotIndexEntry records
// All values little-endian

static constexpr uint32_t SHOT_INDEX_MAGIC = 0x58444953; // 'S''I''D''X' little-endian
static constexpr uint16_t SHOT_INDEX_VERSION = 1;
static constexpr uint16_t SHOT_INDEX_HEADER_SIZE = 32;
static constexpr uint16_t SHOT_INDEX_ENTRY_SIZE = 128;

// Index entry flags
static constexpr uint8_t SHOT_FLAG_COMPLETED = 0x01;
static constexpr uint8_t SHOT_FLAG_DELETED = 0x02;
static constexpr uint8_t SHOT_FLAG_HAS_NOTES = 0x04;

#pragma pack(push,1)
struct ShotIndexHeader {
    uint32_t magic;          // SHOT_INDEX_MAGIC
    uint16_t version;        // SHOT_INDEX_VERSION
    uint16_t entrySize;      // SHOT_INDEX_ENTRY_SIZE
    uint32_t entryCount;     // Number of entries in file
    uint32_t nextId;         // Next shot ID to use
    uint8_t  reserved[16];   // Future expansion
};

struct ShotIndexEntry {
    uint32_t id;             // Shot ID
    uint32_t timestamp;      // Unix timestamp
    uint32_t duration;       // Duration in ms
    uint16_t volume;         // Final weight (g * 10)
    uint8_t  rating;         // 0-5 star rating from notes
    uint8_t  flags;          // Bit flags (completed, deleted, etc.)
    char     profileId[32];  // Profile ID, null-terminated
    char     profileName[48];// Profile name, null-terminated
    uint8_t  reserved[32];   // Future expansion
};
#pragma pack(pop)

static_assert(sizeof(ShotIndexHeader) == SHOT_INDEX_HEADER_SIZE, "ShotIndexHeader size mismatch");
static_assert(sizeof(ShotIndexEntry) == SHOT_INDEX_ENTRY_SIZE, "ShotIndexEntry size mismatch");

#endif // SHOT_LOG_FORMAT_H
