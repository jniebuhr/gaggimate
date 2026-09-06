// Load / chaos tests: ResumableDownloader over real sockets against chaos_server.py (GM-203).
// Needs OTA_CHAOS_URL (see scripts/ota_testbench.sh); skipped otherwise.

#include <unity.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <thread>
#include <vector>

#include "PosixHttpTransport.h"
#include "ResumableDownloader.cpp"
#include "asset_gen.h"

static std::string baseUrl() {
    const char *url = getenv("OTA_CHAOS_URL");
    return url == nullptr ? "" : url;
}

static int loadIterations() {
    const char *value = getenv("OTA_LOAD_ITERATIONS");
    return value == nullptr ? 40 : atoi(value);
}

struct TestEnv : public DownloadEnv {
    std::vector<uint32_t> delays;
    void delayMs(uint32_t ms) override {
        // Real backoff is 2-30 s; sleep 1 % of it so the bench stays fast but still yields.
        delays.push_back(ms);
        std::this_thread::sleep_for(std::chrono::milliseconds(ms / 100));
    }
    bool waitForNetwork(uint32_t) override { return true; }
    uint8_t *allocBuffer(size_t size) override { return static_cast<uint8_t *>(malloc(size)); }
    void freeBuffer(uint8_t *buffer) override { free(buffer); }
};

// Plain GET helper for control endpoints and reference checks; no chaos on those routes.
static bool httpGet(const std::string &url, std::string &body, int *statusOut = nullptr) {
    PosixHttpTransport transport(5000);
    if (!transport.begin(url)) {
        return false;
    }
    int status = 0;
    int length = 0;
    if (!transport.open(status, length)) {
        return false;
    }
    if (statusOut != nullptr) {
        *statusOut = status;
    }
    body.clear();
    uint8_t buf[4096];
    int n = 0;
    while ((n = transport.read(buf, sizeof(buf))) > 0) {
        body.append(reinterpret_cast<char *>(buf), static_cast<size_t>(n));
    }
    transport.end();
    return true;
}

static void control(const std::string &path) {
    std::string body;
    TEST_ASSERT_TRUE_MESSAGE(httpGet(baseUrl() + path, body), "control request failed");
}

static int controlInt(const std::string &path, const char *key) {
    std::string body;
    TEST_ASSERT_TRUE(httpGet(baseUrl() + path, body));
    std::string needle = std::string("\"") + key + "\": ";
    size_t pos = body.find(needle);
    TEST_ASSERT_TRUE_MESSAGE(pos != std::string::npos, body.c_str());
    return atoi(body.c_str() + pos + needle.size());
}

static size_t assetSize(const std::string &name) {
    if (name == "small.bin") {
        return 256 * 1024;
    }
    if (name == "big.bin") {
        return 4 * 1024 * 1024;
    }
    return 1024 * 1024;
}

struct Download {
    std::vector<uint8_t> data;
    int restarts = 0;
    int attempts = 0;
    bool ok = false;
    std::string etag;
    std::vector<size_t> progress;
    TestEnv env;

    bool run(const std::string &url, int timeoutMs = 1000) {
        PosixHttpTransport transport(timeoutMs);
        DownloadSink sink;
        sink.write = [this](const uint8_t *d, size_t len) {
            data.insert(data.end(), d, d + len);
            return true;
        };
        sink.restart = [this]() {
            restarts++;
            data.clear();
            return true;
        };
        ResumableDownloader downloader(transport, env, url, sink,
                                       [this](size_t received, size_t) { progress.push_back(received); });
        ok = downloader.run();
        attempts = downloader.attempts();
        etag = downloader.etag();
        return ok;
    }
    // The ETag names the asset version, so the expected bytes can be regenerated locally.
    void expectAsset(const std::string &name) {
        unsigned version = 0;
        TEST_ASSERT_EQUAL_MESSAGE(1, sscanf(etag.c_str(), ("\"" + name + "-v%u\"").c_str(), &version), etag.c_str());
        std::vector<uint8_t> expected = generateAsset(name, version, assetSize(name));
        TEST_ASSERT_EQUAL_MESSAGE(expected.size(), data.size(), "downloaded size");
        TEST_ASSERT_EQUAL_MEMORY_MESSAGE(expected.data(), data.data(), expected.size(), "bytes");
        size_t last = 0;
        for (size_t p : progress) {
            TEST_ASSERT_TRUE_MESSAGE(p >= last || p == 0, "progress must only go backwards on a restart");
            last = p;
        }
    }
};

static std::string releaseUrl(const std::string &name) { return baseUrl() + "/releases/latest/download/" + name; }

#define REQUIRE_SERVER()                                                                                                         \
    if (baseUrl().empty()) {                                                                                                     \
        TEST_IGNORE_MESSAGE("OTA_CHAOS_URL not set, skipping socket tests");                                                     \
    }

void setUp() {}
void tearDown() {}

void test_clean_downloads_take_one_attempt() {
    REQUIRE_SERVER();
    control("/control/reset?seed=1");
    for (int i = 0; i < 3; i++) {
        Download d;
        TEST_ASSERT_TRUE(d.run(releaseUrl("display-firmware.bin")));
        TEST_ASSERT_EQUAL(1, d.attempts);
        TEST_ASSERT_EQUAL(0, d.restarts);
        d.expectAsset("display-firmware.bin");
    }
}

void test_chaos_load() {
    REQUIRE_SERVER();
    const int iterations = loadIterations();
    control("/control/reset?seed=42&drop=0.45&stall=0.10&err=0.10&ignore_range=0.05&stall_seconds=2");
    int totalAttempts = 0;
    int maxAttempts = 0;
    int restarts = 0;
    auto started = std::chrono::steady_clock::now();
    for (int i = 0; i < iterations; i++) {
        Download d;
        const char *name = (i % 5 == 0) ? "small.bin" : "display-firmware.bin";
        char msg[64];
        snprintf(msg, sizeof(msg), "iteration %d failed", i);
        TEST_ASSERT_TRUE_MESSAGE(d.run(releaseUrl(name)), msg);
        d.expectAsset(name);
        totalAttempts += d.attempts;
        maxAttempts = std::max(maxAttempts, d.attempts);
        restarts += d.restarts;
    }
    double seconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - started).count();
    int drops = controlInt("/control/stats", "drops");
    int stalls = controlInt("/control/stats", "stalls");
    int errors = controlInt("/control/stats", "errors");
    printf("chaos load: %d downloads, %d attempts (max %d), %d restarts, faults drop=%d stall=%d err=%d, %.1f s\n", iterations,
           totalAttempts, maxAttempts, restarts, drops, stalls, errors, seconds);
    TEST_ASSERT_TRUE_MESSAGE(drops + stalls + errors > iterations / 2, "chaos was not active");
    TEST_ASSERT_TRUE_MESSAGE(totalAttempts > iterations, "no retries happened");
    TEST_ASSERT_TRUE_MESSAGE(maxAttempts < 40, "a download needed suspiciously many attempts");
}

void test_large_asset_with_throttle_and_drops() {
    REQUIRE_SERVER();
    control("/control/reset?seed=7&drop=0.6&bandwidth=6000000");
    Download d;
    TEST_ASSERT_TRUE(d.run(releaseUrl("big.bin")));
    d.expectAsset("big.bin");
    printf("big asset: %d attempts, %d restarts\n", d.attempts, d.restarts);
}

void test_asset_swap_mid_download_yields_new_version() {
    REQUIRE_SERVER();
    control("/control/reset?seed=3");
    const int before = controlInt("/control/version/display-firmware.bin", "version");
    PosixHttpTransport transport(1000);
    TestEnv env;
    Download d;
    std::atomic<bool> swapped{false};
    std::atomic<bool> relaxOk{false};
    DownloadSink sink;
    sink.write = [&](const uint8_t *data, size_t len) {
        d.data.insert(d.data.end(), data, data + len);
        if (!swapped && d.data.size() > 300000) {
            swapped = true;
            control("/control/swap/display-firmware.bin");
            return true;
        }
        return true;
    };
    sink.restart = [&]() {
        d.restarts++;
        d.data.clear();
        return true;
    };
    // Force the first attempt to end after the swap by dropping every response at a random point.
    control("/control/reset?seed=3&drop=1.0");
    ResumableDownloader downloader(transport, env, releaseUrl("display-firmware.bin"), sink);
    // Only the first attempt should drop; switch chaos off again once the swap happened.
    std::thread relax([&]() {
        while (!swapped) {
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
        }
        std::string body;
        relaxOk = httpGet(baseUrl() + "/control/reset?seed=3", body); // no Unity asserts off the main thread
    });
    bool ok = downloader.run();
    relax.join();
    TEST_ASSERT_TRUE_MESSAGE(relaxOk, "relax control request failed");
    TEST_ASSERT_TRUE(ok);
    d.etag = downloader.etag();
    d.attempts = downloader.attempts();
    TEST_ASSERT_TRUE(d.attempts >= 2);
    TEST_ASSERT_EQUAL(before + 1, controlInt("/control/version/display-firmware.bin", "version"));
    TEST_ASSERT_TRUE_MESSAGE(d.restarts >= 1, "If-Range mismatch must restart from zero");
    d.expectAsset("display-firmware.bin"); // verified against the version named by the final ETag
    TEST_ASSERT_TRUE(d.etag.find("-v" + std::to_string(before + 1)) != std::string::npos);
}

void test_expired_token_is_rejected_but_reresolve_succeeds() {
    REQUIRE_SERVER();
    control("/control/reset?seed=5&token_ttl=0.3");
    // Resolve the CDN URL by hand, wait past the TTL, and confirm the CDN refuses it.
    PosixHttpTransport t(2000);
    TEST_ASSERT_TRUE(t.begin(releaseUrl("small.bin")));
    int status = 0;
    int length = 0;
    for (int hop = 0; hop < 3; hop++) {
        TEST_ASSERT_TRUE(t.open(status, length));
        if (status != 302) {
            break;
        }
        TEST_ASSERT_TRUE(t.followRedirect());
    }
    TEST_ASSERT_EQUAL(200, status);
    t.end();
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    TEST_ASSERT_TRUE(t.open(status, length));
    TEST_ASSERT_EQUAL(403, status);
    t.end();
    // The downloader never reuses the CDN URL, so drops + a short TTL still complete.
    control("/control/reset?seed=5&token_ttl=0.3&drop=0.5");
    Download d;
    TEST_ASSERT_TRUE(d.run(releaseUrl("small.bin")));
    d.expectAsset("small.bin");
    TEST_ASSERT_EQUAL(0, controlInt("/control/stats", "expired_tokens"));
}

void test_stall_is_detected_by_timeout() {
    REQUIRE_SERVER();
    control("/control/reset?seed=9&stall_seconds=1.5");
    Download d;
    auto started = std::chrono::steady_clock::now();
    // Every response stalls before the first byte, so the budget must run out after one read timeout each.
    TEST_ASSERT_FALSE(d.run(baseUrl() + "/stall/small.bin", 300));
    double seconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - started).count();
    TEST_ASSERT_EQUAL(8, d.attempts);
    TEST_ASSERT_TRUE_MESSAGE(seconds < 8 * 1.5, "stall detection must not wait for the server to close");
}

void test_permanent_failure_gives_up() {
    REQUIRE_SERVER();
    control("/control/reset?seed=11");
    Download d;
    TEST_ASSERT_FALSE(d.run(baseUrl() + "/never/small.bin"));
    TEST_ASSERT_EQUAL(8, d.attempts);
    TEST_ASSERT_EQUAL(7, d.env.delays.size());
    TEST_ASSERT_EQUAL(30000, d.env.delays.back());
    Download missing;
    TEST_ASSERT_FALSE(missing.run(baseUrl() + "/nothing/here.bin"));
    TEST_ASSERT_EQUAL(1, missing.attempts);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_clean_downloads_take_one_attempt);
    RUN_TEST(test_chaos_load);
    RUN_TEST(test_large_asset_with_throttle_and_drops);
    RUN_TEST(test_asset_swap_mid_download_yields_new_version);
    RUN_TEST(test_expired_token_is_rejected_but_reresolve_succeeds);
    RUN_TEST(test_stall_is_detected_by_timeout);
    RUN_TEST(test_permanent_failure_gives_up);
    return UNITY_END();
}
