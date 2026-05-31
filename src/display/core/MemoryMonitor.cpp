#include "MemoryMonitor.h"
#include <atomic>
#include <esp_log.h>

namespace {

constexpr const char *TAG = "MemMon";

ESPMemoryMonitor g_monitor;
// Written once by init() (Controller setup task), read from other tasks
// (WebUI status push, OTA). Atomic to avoid a data race on the non-atomic bool.
std::atomic<bool> g_ready{false};

const char *regionName(MemoryRegion r) { return r == MemoryRegion::Psram ? "psram" : "int"; }

const char *stateName(ThresholdState s) {
    switch (s) {
    case ThresholdState::Critical:
        return "CRITICAL";
    case ThresholdState::Warn:
        return "WARN";
    case ThresholdState::Normal:
    default:
        return "OK";
    }
}

} // namespace

namespace gaggimate::memmon {

void init() {
    if (g_ready)
        return;

    MemoryMonitorConfig cfg;
    cfg.sampleIntervalMs = 60000;
    cfg.historySize = 15;
    cfg.internal = {40 * 1024, 20 * 1024};
    cfg.psram = {500 * 1024, 200 * 1024};
    cfg.thresholdHysteresisBytes = 4 * 1024;
    cfg.enableSamplerTask = true;
    cfg.enableFragmentation = true;
    cfg.enableMinEverFree = true;
    cfg.enablePerTaskStacks = false;
    cfg.enableFailedAllocEvents = true;
    cfg.enableScopes = true;
    cfg.maxScopesInHistory = 8;
    cfg.windowStatsSize = 5;
    cfg.stackSize = 4096;
    cfg.priority = 1;
    cfg.coreId = MemoryMonitorConfig::any;
    cfg.usePSRAMBuffers = true;

    if (!g_monitor.init(cfg)) {
        ESP_LOGE(TAG, "init failed");
        return;
    }

    g_monitor.onSample([](const MemorySnapshot &snap) {
        for (const auto &r : snap.regions) {
            ESP_LOGI(TAG, "heartbeat %s free=%u min=%u largest=%u frag=%.2f slope=%.1fB/s t_warn=%us",
                     regionName(r.region), (unsigned)r.freeBytes, (unsigned)r.minimumFreeBytes,
                     (unsigned)r.largestFreeBlock, r.fragmentation, r.freeBytesSlope, (unsigned)r.secondsToWarn);
        }
    });

    g_monitor.onThreshold([](const ThresholdEvent &evt) {
        const char *region = regionName(evt.region);
        const char *state = stateName(evt.state);
        if (evt.state == ThresholdState::Critical) {
            ESP_LOGE(TAG, "%s %s free=%u largest=%u frag=%.2f", region, state, (unsigned)evt.stats.freeBytes,
                     (unsigned)evt.stats.largestFreeBlock, evt.stats.fragmentation);
        } else if (evt.state == ThresholdState::Warn) {
            ESP_LOGW(TAG, "%s %s free=%u largest=%u frag=%.2f", region, state, (unsigned)evt.stats.freeBytes,
                     (unsigned)evt.stats.largestFreeBlock, evt.stats.fragmentation);
        } else {
            ESP_LOGI(TAG, "%s %s free=%u largest=%u", region, state, (unsigned)evt.stats.freeBytes,
                     (unsigned)evt.stats.largestFreeBlock);
        }
    });

    g_monitor.onFailedAlloc([](const FailedAllocEvent &evt) {
        ESP_LOGE(TAG, "FAILED ALLOC size=%u caps=0x%08x fn=%s", (unsigned)evt.requestedBytes, (unsigned)evt.caps,
                 evt.functionName ? evt.functionName : "?");
    });

    g_monitor.installPanicHook([](const MemorySnapshot &snap) {
        for (const auto &r : snap.regions) {
            ESP_LOGE(TAG, "PANIC %s free=%u min=%u largest=%u frag=%.2f", regionName(r.region),
                     (unsigned)r.freeBytes, (unsigned)r.minimumFreeBytes, (unsigned)r.largestFreeBlock, r.fragmentation);
        }
    });

    g_ready = true;
    ESP_LOGI(TAG, "ready: int warn=%u crit=%u | psram warn=%u crit=%u | sample=%ums", (unsigned)cfg.internal.warnBytes,
             (unsigned)cfg.internal.criticalBytes, (unsigned)cfg.psram.warnBytes, (unsigned)cfg.psram.criticalBytes,
             (unsigned)cfg.sampleIntervalMs);
}

ESPMemoryMonitor &instance() { return g_monitor; }
bool isReady() { return g_ready; }

} // namespace gaggimate::memmon
