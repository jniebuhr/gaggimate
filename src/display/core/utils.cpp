#include "utils.h"
#include <array>
#include <esp_heap_caps.h>
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
#if GAGGIMATE_HEAP_PROFILE
    ESP_LOGI("Common", "%s measurement started", label.c_str());
    const size_t intFreeBefore = heap_caps_get_free_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    const size_t intLargestBefore = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    const size_t intTotalBefore = heap_caps_get_total_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    const size_t psramFreeBefore = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    const float intUsedBefore = intTotalBefore ? (intTotalBefore - intFreeBefore) / (float)intTotalBefore * 100 : 0.0f;
    const float intFragBefore = intFreeBefore ? 100 - (intLargestBefore * 100) / intFreeBefore : 0.0f;

    callback();

    const size_t intFreeAfter = heap_caps_get_free_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    const size_t intLargestAfter = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    const size_t intTotalAfter = heap_caps_get_total_size(MALLOC_CAP_DEFAULT | MALLOC_CAP_INTERNAL);
    const size_t psramFreeAfter = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    const float intUsedAfter = intTotalAfter ? (intTotalAfter - intFreeAfter) / (float)intTotalAfter * 100 : 0.0f;
    const float intFragAfter = intFreeAfter ? 100 - (intLargestAfter * 100) / intFreeAfter : 0.0f;

    ESP_LOGI("Common", "%s int=%.2f%%→%.2f%% (Δ%+dkB, frag %.0f%%→%.0f%%) psramΔ=%+dkB", label.c_str(), intUsedBefore,
             intUsedAfter, (int)((int)intFreeBefore - (int)intFreeAfter) / 1024, intFragBefore, intFragAfter,
             (int)((int)psramFreeBefore - (int)psramFreeAfter) / 1024);
#else
    (void)label;
    callback();
#endif
}

#if GAGGIMATE_HEAP_PROFILE
namespace {

struct HeapSnapshot {
    size_t intFree = 0;
    size_t intLargest = 0;
    size_t psramFree = 0;
    size_t psramLargest = 0;
    bool valid = false;
};

static HeapSnapshot s_lastCheckpoint;

HeapSnapshot takeHeapSnapshot() {
    HeapSnapshot snap;
    snap.intFree = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
    snap.intLargest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    snap.psramFree = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    snap.psramLargest = heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM);
    snap.valid = true;
    return snap;
}

} // namespace
#endif

void heap_checkpoint_reset() {
#if GAGGIMATE_HEAP_PROFILE
    s_lastCheckpoint = HeapSnapshot{};
#endif
}

void heap_checkpoint(const char *label) {
#if GAGGIMATE_HEAP_PROFILE
    const HeapSnapshot now = takeHeapSnapshot();
    const float intFrag = now.intFree ? 100.0f - (now.intLargest * 100.0f) / now.intFree : 0.0f;
    const float psramFrag = now.psramFree ? 100.0f - (now.psramLargest * 100.0f) / now.psramFree : 0.0f;

    if (!s_lastCheckpoint.valid) {
        ESP_LOGI("HeapProfile", "[%s] int: free=%u largest=%u frag=%.0f%% | psram: free=%u largest=%u frag=%.0f%%", label,
                 (unsigned)now.intFree, (unsigned)now.intLargest, intFrag, (unsigned)now.psramFree,
                 (unsigned)now.psramLargest, psramFrag);
    } else {
        const int dInt = (int)now.intFree - (int)s_lastCheckpoint.intFree;
        const int dPsram = (int)now.psramFree - (int)s_lastCheckpoint.psramFree;
        ESP_LOGI("HeapProfile",
                 "[%s] int: free=%u (Δ%+dB) largest=%u frag=%.0f%% | psram: free=%u (Δ%+dB) largest=%u frag=%.0f%%",
                 label, (unsigned)now.intFree, dInt, (unsigned)now.intLargest, intFrag, (unsigned)now.psramFree, dPsram,
                 (unsigned)now.psramLargest, psramFrag);
    }
    s_lastCheckpoint = now;
#else
    (void)label;
#endif
}

void heap_dump(const char *label) {
#if GAGGIMATE_HEAP_PROFILE
    ESP_LOGI("HeapProfile", "[%s] heap_caps_print_heap_info(MALLOC_CAP_INTERNAL):", label);
    heap_caps_print_heap_info(MALLOC_CAP_INTERNAL);
    ESP_LOGI("HeapProfile", "[%s] heap_caps_print_heap_info(MALLOC_CAP_SPIRAM):", label);
    heap_caps_print_heap_info(MALLOC_CAP_SPIRAM);
#else
    (void)label;
#endif
}
