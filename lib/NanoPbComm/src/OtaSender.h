#ifndef NANOPBCOMM_OTA_SENDER_H
#define NANOPBCOMM_OTA_SENDER_H

#include <cstddef>
#include <cstdint>
#include <functional>

// Display side of a controller firmware transfer; every link type brings its own implementation.
class OtaSender {
  public:
    static constexpr size_t MD5_LEN = 16;
    // Fill `buf` with up to `len` bytes of the image starting at `offset`; return the bytes read (0 = error).
    using ReadFn = std::function<size_t(uint32_t offset, uint8_t *buf, size_t len)>;
    using ProgressFn = std::function<void(uint32_t sent, uint32_t total)>;

    virtual ~OtaSender() = default;

    virtual bool isLinkUp() const = 0;
    // Blocks the calling task until the controller accepted the whole image or the transfer failed.
    virtual bool run(uint32_t size, const uint8_t md5[MD5_LEN], const ReadFn &read, const ProgressFn &progress) = 0;
};

#endif // NANOPBCOMM_OTA_SENDER_H
