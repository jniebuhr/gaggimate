#ifndef NANOPBCOMM_UART_OTA_H
#define NANOPBCOMM_UART_OTA_H

#include <cstddef>
#include <cstdint>

// Controller firmware update over UartTransport::CHANNEL_OTA. Stop-and-wait: the display sends one request and waits
// for its response before the next, retransmitting on timeout. All integers little-endian.
//
//   BEGIN  [0x01][size u32][md5 x16]   -> controller aborts any running update and starts a new one
//   DATA   [0x02][offset u32][bytes..] -> written if offset == next expected; a repeat of the last chunk is re-ACKed
//   END    [0x03]                      -> verify (MD5 + image check), set boot partition, reboot shortly after
//   ABORT  [0x04]                      -> drop the partial image
//
//   response [cmd | 0x80][status u8][value u32]
//     value = next expected offset (BEGIN / DATA / END), or the Update error code when status is an error
namespace gm_uart_ota {

constexpr size_t CHUNK_SIZE = 1024;
constexpr size_t MD5_LEN = 16;
constexpr size_t BEGIN_LEN = 1 + 4 + MD5_LEN;
constexpr size_t DATA_HEADER_LEN = 1 + 4;
constexpr size_t RESPONSE_LEN = 1 + 1 + 4;

enum Command : uint8_t {
    CMD_BEGIN = 0x01,
    CMD_DATA = 0x02,
    CMD_END = 0x03,
    CMD_ABORT = 0x04,
};
constexpr uint8_t RESPONSE_FLAG = 0x80;

enum Status : uint8_t {
    STATUS_OK = 0,
    STATUS_BAD_STATE = 1,    // DATA/END without a running update
    STATUS_BEGIN_FAILED = 2, // no OTA partition / image too large
    STATUS_WRITE_FAILED = 3,
    STATUS_BAD_OFFSET = 4, // value carries the offset the controller expects
    STATUS_VERIFY_FAILED = 5,
    STATUS_MALFORMED = 6,
};

inline void putU32(uint8_t *out, uint32_t v) {
    out[0] = static_cast<uint8_t>(v);
    out[1] = static_cast<uint8_t>(v >> 8);
    out[2] = static_cast<uint8_t>(v >> 16);
    out[3] = static_cast<uint8_t>(v >> 24);
}

inline uint32_t getU32(const uint8_t *in) {
    return static_cast<uint32_t>(in[0]) | static_cast<uint32_t>(in[1]) << 8 | static_cast<uint32_t>(in[2]) << 16 |
           static_cast<uint32_t>(in[3]) << 24;
}

} // namespace gm_uart_ota

#endif // NANOPBCOMM_UART_OTA_H
