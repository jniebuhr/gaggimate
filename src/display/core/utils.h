#ifndef UTILS_H
#define UTILS_H
#include <Arduino.h>
#include <array>
#include <iomanip>
#include <memory>
#include <sstream>

template <typename T, typename... Args> std::unique_ptr<T> make_unique(Args &&...args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

inline uint8_t randomByte() { return static_cast<uint8_t>(esp_random() & 0xFF); }

String generateShortID(uint8_t length = 10) {
    static const char charset[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    static constexpr size_t charsetSize = sizeof(charset) - 1;

    uint32_t seed = micros() ^ ((uint32_t)ESP.getEfuseMac() << 8);
    randomSeed(seed);

    String id;
    for (uint8_t i = 0; i < length; ++i) {
        id += charset[random(charsetSize)];
    }
    return id;
}

#endif // UTILS_H
