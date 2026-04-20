#include "utils.h"
#include <array>
#include <iomanip>
#include <memory>
#include <numeric>

uint8_t randomByte() { return static_cast<uint8_t>(esp_random() & 0xFF); }

String generateShortID(uint8_t length) {
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

std::vector<String> explode(const String &input, char delim) {
    std::vector<String> strings;
    size_t start;
    size_t end = 0;
    std::string str = std::string(input.c_str());
    while ((start = str.find_first_not_of(delim, end)) != std::string::npos) {
        end = str.find(delim, start);
        strings.emplace_back(str.substr(start, end - start).c_str());
    }
    return strings;
}

String implode(const std::vector<String> &strings, String delim) {
    if (strings.size() == 0) {
        return "";
    }
    if (strings.size() == 1) {
        return strings.at(0);
    }
    return std::accumulate(std::next(strings.begin()), strings.end(), strings[0],
                           [delim](String a, String b) { return a + delim + b; });
}

void measure_heap(const String &label, std::function<void()> callback) {
    ESP_LOGI("Common", "%s measurement started", label.c_str());
    size_t freeBefore = heap_caps_get_free_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    size_t largestBefore = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    size_t totalBefore = heap_caps_get_total_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    float usedPercentBefore = (totalBefore - freeBefore) / (float)totalBefore * 100;
    float fragmentationBefore = 100 - (largestBefore * 100) / freeBefore;

    callback();

    size_t freeAfter = heap_caps_get_free_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    size_t largestAfter = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    size_t totalAfter = heap_caps_get_total_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    float usedPercentAfter = (totalAfter - freeAfter) / (float)totalAfter * 100;
    float fragmentationAfter = 100 - (largestAfter * 100) / freeAfter;

    ESP_LOGI("Common", "%s changed heap usage from %.2f%% to %.2f%% by %dkB (%.2f%% to %.2f%% fragmentation)", label.c_str(),
             usedPercentBefore, usedPercentAfter, (freeBefore - freeAfter) / 1024, fragmentationBefore, fragmentationAfter);
}
