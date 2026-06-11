#ifndef NANOPBCOMM_UART_FRAMING_H
#define NANOPBCOMM_UART_FRAMING_H

#include <cstddef>
#include <cstdint>

// COBS + CRC framing helpers for the UART transport. No Arduino/nanopb deps so
// they're easy to test on the host. Frame layout is:
//
//     COBS( datagram || crc16 ) || 0x00
//
// COBS guarantees a zero-free body, so the 0x00 acts as the frame delimiter.
namespace gm_uart {

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no final xor).
inline uint16_t crc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= static_cast<uint16_t>(data[i]) << 8;
        for (int bit = 0; bit < 8; bit++)
            crc = (crc & 0x8000) ? static_cast<uint16_t>((crc << 1) ^ 0x1021) : static_cast<uint16_t>(crc << 1);
    }
    return crc;
}

// Worst-case encoded length, delimiter not included.
inline constexpr size_t cobsMaxEncodedLen(size_t length) { return length + length / 254 + 1; }

// Encode into `out` (>= cobsMaxEncodedLen(length) bytes), return bytes written.
// Caller appends the 0x00 delimiter.
inline size_t cobsEncode(const uint8_t *input, size_t length, uint8_t *out) {
    size_t readIdx = 0;
    size_t writeIdx = 1; // out[codeIdx] gets back-filled with the run length
    size_t codeIdx = 0;
    uint8_t code = 1;

    while (readIdx < length) {
        if (input[readIdx] == 0) {
            out[codeIdx] = code;
            code = 1;
            codeIdx = writeIdx++;
        } else {
            out[writeIdx++] = input[readIdx];
            if (++code == 0xFF) { // full run, close the group without an implied zero
                out[codeIdx] = code;
                code = 1;
                codeIdx = writeIdx++;
            }
        }
        readIdx++;
    }
    out[codeIdx] = code;
    return writeIdx;
}

// Decode one block (between delimiters, delimiter excluded). Returns decoded
// length, or 0 if the block is corrupt or won't fit in `out`.
inline size_t cobsDecode(const uint8_t *input, size_t length, uint8_t *out, size_t outCap) {
    size_t readIdx = 0;
    size_t writeIdx = 0;
    while (readIdx < length) {
        const uint8_t code = input[readIdx++];
        if (code == 0)
            return 0; // a real COBS block never contains a zero
        for (uint8_t i = 1; i < code; i++) {
            if (readIdx >= length || writeIdx >= outCap)
                return 0;
            out[writeIdx++] = input[readIdx++];
        }
        if (code != 0xFF && readIdx < length) { // group stood in for a stuffed zero
            if (writeIdx >= outCap)
                return 0;
            out[writeIdx++] = 0;
        }
    }
    return writeIdx;
}

} // namespace gm_uart

#endif // NANOPBCOMM_UART_FRAMING_H
