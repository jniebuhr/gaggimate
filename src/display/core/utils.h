#pragma once
#ifndef UTILS_H
#define UTILS_H
#include <Arduino.h>
#include <memory>

template <typename T, typename... Args> std::unique_ptr<T> make_unique(Args &&...args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

extern uint8_t randomByte();
extern String generateShortID(uint8_t length = 10);
extern std::vector<String> explode(const String &input, char delim);
extern String implode(const std::vector<String> &strings, String delim);

#endif // UTILS_H
