// Unit tests: ResumableDownloader retry / resume logic against a scripted fake server (GM-203).
// Host-side, no ESP32/Arduino runtime — pio test -e native -f test_ota_download.

#include <unity.h>

#include <cstdlib>
#include <cstring>
#include <map>
#include <string>
#include <vector>

#include "ResumableDownloader.cpp"
#include "asset_gen.h"

enum class Fault { NONE, CONNECT_FAIL, STATUS, DROP_AFTER, STALL_AFTER, IGNORE_RANGE, BAD_RANGE, SWAP_ASSET, OVERSEND };

struct FaultSpec {
    Fault kind = Fault::NONE;
    size_t at = 0; // absolute asset offset for DROP_AFTER / STALL_AFTER
    int status = 0;
};

struct AttemptLog {
    std::string range;
    std::string ifRange;
    int opens = 0;
    int status = 0;
};

// In-memory GitHub stand-in: redirect hops, Range / If-Range semantics and one scripted fault per attempt.
class FakeTransport : public HttpTransport {
  public:
    std::vector<uint8_t> asset = generateAsset("fake.bin", 1, 300000);
    std::string etag = "\"fake-v1\"";
    int redirectHops = 2;
    bool missingLocation = false;
    std::map<int, FaultSpec> faults; // keyed by attempt number (1-based)
    std::vector<AttemptLog> attempts;
    int begins = 0;

    bool begin(const std::string &url) override {
        begins++;
        attempts.push_back({});
        _hop = 0;
        _headers.clear();
        _url = url;
        FaultSpec f = fault();
        if (f.kind == Fault::SWAP_ASSET) {
            asset = generateAsset("fake.bin", 2, 300000);
            etag = "\"fake-v2\"";
        }
        return true;
    }
    void setHeader(const char *key, const char *value) override { _headers[key] = value; }
    bool open(int &status, int &contentLength) override {
        current().opens++;
        _hop++;
        _etag.clear();
        _contentRange.clear();
        _pos = _end = 0;
        _oversend = false;
        FaultSpec f = fault();
        if (f.kind == Fault::CONNECT_FAIL) {
            return false;
        }
        if (_hop <= redirectHops) {
            status = 302;
            contentLength = 0;
            return true;
        }
        current().range = _headers.count("Range") ? _headers["Range"] : "";
        current().ifRange = _headers.count("If-Range") ? _headers["If-Range"] : "";
        if (f.kind == Fault::STATUS) {
            status = f.status;
            contentLength = 0;
            current().status = status;
            return true;
        }
        size_t start = 0;
        bool partial = false;
        unsigned requested = 0;
        if (f.kind != Fault::IGNORE_RANGE && !current().range.empty() &&
            sscanf(current().range.c_str(), "bytes=%u-", &requested) == 1 &&
            (current().ifRange.empty() || current().ifRange == etag)) {
            if (requested >= asset.size()) {
                status = 416;
                contentLength = 0;
                current().status = status;
                return true;
            }
            start = requested;
            partial = true;
        }
        _etag = etag;
        _pos = start;
        _end = asset.size();
        status = partial ? 206 : 200;
        contentLength = static_cast<int>(_end - _pos);
        if (partial) {
            size_t shown = f.kind == Fault::BAD_RANGE ? start + 1 : start;
            _contentRange =
                "bytes " + std::to_string(shown) + "-" + std::to_string(_end - 1) + "/" + std::to_string(asset.size());
        }
        _oversend = f.kind == Fault::OVERSEND;
        current().status = status;
        return true;
    }
    bool followRedirect() override { return !missingLocation; }
    int read(uint8_t *buffer, size_t len) override {
        FaultSpec f = fault();
        if (f.kind == Fault::DROP_AFTER && _pos >= f.at) {
            return -1;
        }
        if (f.kind == Fault::STALL_AFTER && _pos >= f.at) {
            return 0;
        }
        if (_pos >= _end) {
            if (_oversend) {
                memset(buffer, 0xAB, len);
                return static_cast<int>(len);
            }
            return 0;
        }
        size_t n = std::min(len, _end - _pos);
        memcpy(buffer, asset.data() + _pos, n);
        _pos += n;
        return static_cast<int>(n);
    }
    bool isComplete() override { return _end > 0 && _pos >= _end; }
    std::string header(const char *key) override {
        if (strcasecmp(key, "ETag") == 0) {
            return _etag;
        }
        if (strcasecmp(key, "Content-Range") == 0) {
            return _contentRange;
        }
        return "";
    }
    void end() override {}

  private:
    AttemptLog &current() { return attempts.back(); }
    FaultSpec fault() {
        auto it = faults.find(static_cast<int>(attempts.size()));
        return it == faults.end() ? FaultSpec{} : it->second;
    }
    std::string _url;
    std::map<std::string, std::string> _headers;
    int _hop = 0;
    size_t _pos = 0;
    size_t _end = 0;
    bool _oversend = false;
    std::string _etag;
    std::string _contentRange;
};

struct FakeEnv : public DownloadEnv {
    std::vector<uint32_t> delays;
    int networkWaits = 0;
    bool failAlloc = false;
    void delayMs(uint32_t ms) override { delays.push_back(ms); }
    bool waitForNetwork(uint32_t) override {
        networkWaits++;
        return true;
    }
    uint8_t *allocBuffer(size_t size) override { return failAlloc ? nullptr : static_cast<uint8_t *>(malloc(size)); }
    void freeBuffer(uint8_t *buffer) override { free(buffer); }
};

struct MemorySink {
    std::vector<uint8_t> data;
    int restarts = 0;
    bool failWrite = false;
    DownloadSink sink() {
        DownloadSink s;
        s.write = [this](const uint8_t *d, size_t len) {
            if (failWrite) {
                return false;
            }
            data.insert(data.end(), d, d + len);
            return true;
        };
        s.restart = [this]() {
            restarts++;
            data.clear();
            return true;
        };
        return s;
    }
};

struct Rig {
    FakeTransport transport;
    FakeEnv env;
    MemorySink sink;
    std::vector<size_t> progress;
    bool result = false;
    int attempts = 0;
    std::string etag;

    bool run() {
        ResumableDownloader downloader(transport, env, "https://github.com/x/releases/latest/download/fake.bin", sink.sink(),
                                       [this](size_t received, size_t) { progress.push_back(received); });
        result = downloader.run();
        attempts = downloader.attempts();
        etag = downloader.etag();
        return result;
    }
    void expectAsset() {
        TEST_ASSERT_EQUAL_MESSAGE(transport.asset.size(), sink.data.size(), "downloaded size");
        TEST_ASSERT_EQUAL_MEMORY_MESSAGE(transport.asset.data(), sink.data.data(), transport.asset.size(), "bytes");
    }
    void expectProgressMonotonic() {
        size_t last = 0;
        for (size_t p : progress) {
            TEST_ASSERT_TRUE_MESSAGE(p >= last || p == 0, "progress must only go backwards on a restart");
            last = p;
        }
        TEST_ASSERT_EQUAL_MESSAGE(transport.asset.size(), progress.back(), "final progress");
    }
};

void setUp() {}
void tearDown() {}

void test_clean_download_single_attempt() {
    Rig rig;
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(1, rig.attempts);
    rig.expectAsset();
    rig.expectProgressMonotonic();
    TEST_ASSERT_EQUAL_STRING("", rig.transport.attempts[0].range.c_str());
    TEST_ASSERT_EQUAL(3, rig.transport.attempts[0].opens); // two redirect hops plus the asset
    TEST_ASSERT_EQUAL_STRING("\"fake-v1\"", rig.etag.c_str());
    TEST_ASSERT_EQUAL(0, rig.sink.restarts);
}

void test_drop_resumes_with_range_and_if_range() {
    Rig rig;
    rig.transport.faults[1] = {Fault::DROP_AFTER, 120000};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(2, rig.attempts);
    rig.expectAsset();
    rig.expectProgressMonotonic();
    // The drop lands on a chunk boundary inside [120000, 120000 + chunk), so the resume offset must match it.
    unsigned offset = 0;
    TEST_ASSERT_EQUAL(1, sscanf(rig.transport.attempts[1].range.c_str(), "bytes=%u-", &offset));
    TEST_ASSERT_TRUE(offset >= 120000 && offset < 120000 + 4096);
    TEST_ASSERT_EQUAL_STRING("\"fake-v1\"", rig.transport.attempts[1].ifRange.c_str());
    TEST_ASSERT_EQUAL(206, rig.transport.attempts[1].status);
    TEST_ASSERT_EQUAL(0, rig.sink.restarts);
    TEST_ASSERT_EQUAL(3, rig.transport.attempts[1].opens); // redirects re-resolved on the retry
}

void test_stall_resumes() {
    Rig rig;
    rig.transport.faults[1] = {Fault::STALL_AFTER, 50000};
    rig.transport.faults[2] = {Fault::STALL_AFTER, 200000};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(3, rig.attempts);
    rig.expectAsset();
    TEST_ASSERT_EQUAL(206, rig.transport.attempts[2].status);
}

void test_transient_status_retries_then_succeeds() {
    Rig rig;
    rig.transport.faults[1] = {Fault::STATUS, 0, 503};
    rig.transport.faults[2] = {Fault::STATUS, 0, 429};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(3, rig.attempts);
    rig.expectAsset();
    TEST_ASSERT_EQUAL(2, rig.env.delays.size());
    TEST_ASSERT_EQUAL(2000, rig.env.delays[0]);
    TEST_ASSERT_EQUAL(4000, rig.env.delays[1]);
}

void test_client_error_is_fatal() {
    Rig rig;
    rig.transport.faults[1] = {Fault::STATUS, 0, 404};
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(1, rig.attempts);
    TEST_ASSERT_EQUAL(0, rig.env.delays.size());
    TEST_ASSERT_EQUAL(0, rig.sink.data.size());
}

void test_asset_swap_restarts_from_zero() {
    Rig rig;
    rig.transport.faults[1] = {Fault::DROP_AFTER, 100000};
    rig.transport.faults[2] = {Fault::SWAP_ASSET};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(2, rig.attempts);
    TEST_ASSERT_EQUAL(200, rig.transport.attempts[1].status); // If-Range mismatch → full body
    TEST_ASSERT_EQUAL(1, rig.sink.restarts);
    rig.expectAsset(); // the new asset
    TEST_ASSERT_EQUAL_STRING("\"fake-v2\"", rig.etag.c_str());
}

void test_ignored_range_restarts_from_zero() {
    Rig rig;
    rig.transport.faults[1] = {Fault::DROP_AFTER, 100000};
    rig.transport.faults[2] = {Fault::IGNORE_RANGE};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(2, rig.attempts);
    TEST_ASSERT_EQUAL(1, rig.sink.restarts);
    rig.expectAsset();
    rig.expectProgressMonotonic();
}

void test_416_restarts_and_retries() {
    Rig rig;
    rig.transport.faults[1] = {Fault::DROP_AFTER, 100000};
    rig.transport.faults[2] = {Fault::STATUS, 0, 416};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(3, rig.attempts);
    TEST_ASSERT_EQUAL(1, rig.sink.restarts);
    TEST_ASSERT_EQUAL_STRING("", rig.transport.attempts[2].range.c_str()); // restarted → no Range
    rig.expectAsset();
}

void test_bad_content_range_restarts() {
    Rig rig;
    rig.transport.faults[1] = {Fault::DROP_AFTER, 100000};
    rig.transport.faults[2] = {Fault::BAD_RANGE};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(3, rig.attempts);
    TEST_ASSERT_EQUAL(1, rig.sink.restarts);
    rig.expectAsset();
}

void test_oversend_restarts() {
    Rig rig;
    rig.transport.faults[1] = {Fault::OVERSEND};
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(2, rig.attempts);
    TEST_ASSERT_EQUAL(1, rig.sink.restarts);
    rig.expectAsset();
}

void test_connect_failures_exhaust_budget_with_backoff() {
    Rig rig;
    for (int i = 1; i <= 8; i++) {
        rig.transport.faults[i] = {Fault::CONNECT_FAIL};
    }
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(8, rig.attempts);
    TEST_ASSERT_EQUAL(7, rig.env.delays.size());
    const uint32_t expected[] = {2000, 4000, 8000, 16000, 30000, 30000, 30000};
    for (size_t i = 0; i < 7; i++) {
        TEST_ASSERT_EQUAL(expected[i], rig.env.delays[i]);
    }
    TEST_ASSERT_EQUAL(7, rig.env.networkWaits);
    TEST_ASSERT_EQUAL(0, rig.sink.data.size());
}

void test_permanent_drops_give_up_without_completing() {
    Rig rig;
    for (int i = 1; i <= 20; i++) {
        rig.transport.faults[i] = {Fault::DROP_AFTER, 150000};
    }
    TEST_ASSERT_FALSE(rig.run());
    // The first attempt makes progress and is free; the next eight deliver nothing and use up the budget.
    TEST_ASSERT_EQUAL(9, rig.attempts);
    TEST_ASSERT_EQUAL(8, rig.env.delays.size());
    TEST_ASSERT_EQUAL(2000, rig.env.delays[0]);
    TEST_ASSERT_EQUAL(4000, rig.env.delays[1]);
    TEST_ASSERT_EQUAL(30000, rig.env.delays[7]);
    TEST_ASSERT_TRUE(rig.sink.data.size() < rig.transport.asset.size());
}

void test_progressing_attempts_do_not_consume_the_budget() {
    Rig rig;
    for (int i = 1; i <= 25; i++) {
        rig.transport.faults[i] = {Fault::DROP_AFTER, static_cast<size_t>(i * 10000)};
    }
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(26, rig.attempts);
    for (uint32_t d : rig.env.delays) {
        TEST_ASSERT_EQUAL(2000, d); // backoff resets after every attempt that delivered data
    }
    TEST_ASSERT_EQUAL(0, rig.sink.restarts);
    rig.expectAsset();
    rig.expectProgressMonotonic();
}

void test_total_attempt_cap_bounds_trickling_links() {
    Rig rig;
    for (int i = 1; i <= 100; i++) {
        rig.transport.faults[i] = {Fault::DROP_AFTER, static_cast<size_t>(i * 1000)};
    }
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(64, rig.attempts);
    TEST_ASSERT_TRUE(rig.sink.data.size() < rig.transport.asset.size());
}

void test_sink_write_failure_is_fatal() {
    Rig rig;
    rig.sink.failWrite = true;
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(1, rig.attempts);
}

void test_missing_location_retries_then_gives_up() {
    Rig rig;
    rig.transport.missingLocation = true;
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(8, rig.attempts);
}

void test_too_many_redirects_fail_attempt() {
    Rig rig;
    rig.transport.redirectHops = 5;
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(8, rig.attempts);
    rig.transport.redirectHops = 4;
    Rig ok;
    ok.transport.redirectHops = 4;
    TEST_ASSERT_TRUE(ok.run());
    ok.expectAsset();
}

void test_alloc_failure_returns_false_without_attempts() {
    Rig rig;
    rig.env.failAlloc = true;
    TEST_ASSERT_FALSE(rig.run());
    TEST_ASSERT_EQUAL(0, rig.transport.begins);
}

void test_many_drops_still_complete() {
    Rig rig;
    for (int i = 1; i <= 7; i++) {
        rig.transport.faults[i] = {Fault::DROP_AFTER, static_cast<size_t>(i * 40000)};
    }
    TEST_ASSERT_TRUE(rig.run());
    TEST_ASSERT_EQUAL(8, rig.attempts);
    TEST_ASSERT_EQUAL(0, rig.sink.restarts);
    rig.expectAsset();
    rig.expectProgressMonotonic();
}

void test_parse_content_range() {
    size_t start = 0;
    size_t total = 0;
    TEST_ASSERT_TRUE(ResumableDownloader::parseContentRange("bytes 100-199/1000", start, total));
    TEST_ASSERT_EQUAL(100, start);
    TEST_ASSERT_EQUAL(1000, total);
    TEST_ASSERT_TRUE(ResumableDownloader::parseContentRange("bytes 0-4887727/4887728", start, total));
    TEST_ASSERT_EQUAL(0, start);
    TEST_ASSERT_FALSE(ResumableDownloader::parseContentRange("bytes */1000", start, total));
    TEST_ASSERT_FALSE(ResumableDownloader::parseContentRange("bytes 200-100/1000", start, total));
    TEST_ASSERT_FALSE(ResumableDownloader::parseContentRange("bytes 100-1000/1000", start, total));
    TEST_ASSERT_FALSE(ResumableDownloader::parseContentRange("", start, total));
    TEST_ASSERT_FALSE(ResumableDownloader::parseContentRange("items 1-2/3", start, total));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_clean_download_single_attempt);
    RUN_TEST(test_drop_resumes_with_range_and_if_range);
    RUN_TEST(test_stall_resumes);
    RUN_TEST(test_transient_status_retries_then_succeeds);
    RUN_TEST(test_client_error_is_fatal);
    RUN_TEST(test_asset_swap_restarts_from_zero);
    RUN_TEST(test_ignored_range_restarts_from_zero);
    RUN_TEST(test_416_restarts_and_retries);
    RUN_TEST(test_bad_content_range_restarts);
    RUN_TEST(test_oversend_restarts);
    RUN_TEST(test_connect_failures_exhaust_budget_with_backoff);
    RUN_TEST(test_permanent_drops_give_up_without_completing);
    RUN_TEST(test_progressing_attempts_do_not_consume_the_budget);
    RUN_TEST(test_total_attempt_cap_bounds_trickling_links);
    RUN_TEST(test_sink_write_failure_is_fatal);
    RUN_TEST(test_missing_location_retries_then_gives_up);
    RUN_TEST(test_too_many_redirects_fail_attempt);
    RUN_TEST(test_alloc_failure_returns_false_without_attempts);
    RUN_TEST(test_many_drops_still_complete);
    RUN_TEST(test_parse_content_range);
    return UNITY_END();
}
