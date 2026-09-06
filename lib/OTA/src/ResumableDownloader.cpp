#include "ResumableDownloader.h"
#include "ota_log.h"
#include <algorithm>
#include <cstdio>
#include <utility>

static const char *TAG = "ResumableDownloader";

ResumableDownloader::ResumableDownloader(HttpTransport &transport, DownloadEnv &env, std::string url, DownloadSink sink,
                                         download_progress_t progress, DownloadPolicy policy)
    : _transport(transport), _env(env), _url(std::move(url)), _sink(std::move(sink)), _progress(std::move(progress)),
      _policy(policy) {}

bool ResumableDownloader::run() {
    uint8_t *buffer = _env.allocBuffer(_policy.chunkSize);
    if (buffer == nullptr) {
        OTA_LOGE(TAG, "Could not allocate the download buffer");
        return false;
    }
    bool ok = false;
    uint32_t backoffMs = _policy.initialBackoffMs;
    int withoutProgress = 0;
    for (_attempts = 1; _attempts <= _policy.maxTotalAttempts; _attempts++) {
        _progressed = false;
        Outcome outcome = runAttempt(buffer);
        if (outcome == Outcome::DONE) {
            ok = true;
            break;
        }
        if (outcome == Outcome::FATAL) {
            break;
        }
        // An attempt that moved the offset forward does not count against the budget; only dead ones do.
        if (_progressed) {
            withoutProgress = 0;
            backoffMs = _policy.initialBackoffMs;
        } else {
            withoutProgress++;
        }
        if (withoutProgress >= _policy.maxAttempts || _attempts == _policy.maxTotalAttempts) {
            break;
        }
        OTA_LOGW(TAG, "Attempt %d failed at %u/%u bytes (%d without progress), retrying in %u ms", _attempts,
                 static_cast<unsigned>(_received), static_cast<unsigned>(_total), withoutProgress,
                 static_cast<unsigned>(backoffMs));
        if (!_env.waitForNetwork(_policy.networkWaitMs)) {
            OTA_LOGW(TAG, "Station still not associated, trying anyway");
        }
        _env.delayMs(backoffMs);
        backoffMs = std::min(backoffMs * 2, _policy.maxBackoffMs);
    }
    _attempts = std::min(_attempts, _policy.maxTotalAttempts);
    _env.freeBuffer(buffer);
    return ok;
}

ResumableDownloader::Outcome ResumableDownloader::runAttempt(uint8_t *buffer) {
    if (!_transport.begin(_url)) {
        OTA_LOGE(TAG, "Could not create the HTTP client");
        return Outcome::RETRY;
    }
    if (_received > 0) {
        char range[32];
        snprintf(range, sizeof(range), "bytes=%u-", static_cast<unsigned>(_received));
        _transport.setHeader("Range", range);
        if (!_etag.empty()) {
            _transport.setHeader("If-Range", _etag.c_str());
        }
    }

    int status = 0;
    int contentLength = 0;
    Outcome outcome = Outcome::RETRY;
    if (openWithRedirects(status, contentLength)) {
        outcome = consumeResponse(status, contentLength, buffer);
    }
    _transport.end();
    return outcome;
}

bool ResumableDownloader::openWithRedirects(int &status, int &contentLength) {
    for (int hop = 0; hop < _policy.maxRedirects; hop++) {
        if (!_transport.open(status, contentLength)) {
            OTA_LOGE(TAG, "Connection or response header failure");
            return false;
        }
        if (status != 301 && status != 302 && status != 303 && status != 307 && status != 308) {
            return true;
        }
        // GitHub redirects to a signed, time-limited CDN URL, so every attempt re-resolves it from scratch.
        if (!_transport.followRedirect()) {
            OTA_LOGE(TAG, "HTTP %d without a usable Location header", status);
            return false;
        }
    }
    OTA_LOGE(TAG, "Too many redirects");
    return false;
}

ResumableDownloader::Outcome ResumableDownloader::consumeResponse(int status, int contentLength, uint8_t *buffer) {
    OTA_LOGI(TAG, "HTTP %d, content length %d, offset %u", status, contentLength, static_cast<unsigned>(_received));
    if (status == 200) {
        // A full body on a resume means the asset changed (If-Range mismatch) or Range was ignored.
        if (_received > 0 && !restartFromZero()) {
            return Outcome::FATAL;
        }
        _etag = _transport.header("ETag");
        _total = contentLength > 0 ? static_cast<size_t>(contentLength) : 0;
    } else if (status == 206) {
        size_t start = 0;
        size_t total = 0;
        std::string contentRange = _transport.header("Content-Range");
        if (!parseContentRange(contentRange, start, total) || start != _received) {
            OTA_LOGW(TAG, "Unexpected Content-Range '%s' for offset %u", contentRange.c_str(), static_cast<unsigned>(_received));
            return restartFromZero() ? Outcome::RETRY : Outcome::FATAL;
        }
        _total = total;
    } else if (status == 416) {
        OTA_LOGW(TAG, "Range not satisfiable, starting over");
        return restartFromZero() ? Outcome::RETRY : Outcome::FATAL;
    } else if (status == 408 || status == 429 || status >= 500) {
        OTA_LOGW(TAG, "Transient HTTP %d", status);
        return Outcome::RETRY;
    } else {
        OTA_LOGE(TAG, "HTTP %d", status);
        return Outcome::FATAL;
    }
    return readBody(buffer);
}

ResumableDownloader::Outcome ResumableDownloader::readBody(uint8_t *buffer) {
    while (true) {
        int n = _transport.read(buffer, _policy.chunkSize);
        if (n < 0) {
            OTA_LOGE(TAG, "Read error at %u bytes", static_cast<unsigned>(_received));
            return Outcome::RETRY;
        }
        if (n == 0) {
            // Zero bytes is either the end of the body or a stall / close before the body was complete.
            if (_transport.isComplete()) {
                break;
            }
            OTA_LOGW(TAG, "Connection stalled or closed at %u bytes", static_cast<unsigned>(_received));
            return Outcome::RETRY;
        }
        if (_total > 0 && _received + static_cast<size_t>(n) > _total) {
            OTA_LOGE(TAG, "Server sent more than the announced %u bytes", static_cast<unsigned>(_total));
            return restartFromZero() ? Outcome::RETRY : Outcome::FATAL;
        }
        if (!_sink.write(buffer, static_cast<size_t>(n))) {
            return Outcome::FATAL;
        }
        _received += static_cast<size_t>(n);
        _progressed = true;
        reportProgress(false);
    }
    if (_total > 0 && _received < _total) {
        OTA_LOGW(TAG, "Response ended at %u of %u bytes", static_cast<unsigned>(_received), static_cast<unsigned>(_total));
        return Outcome::RETRY;
    }
    reportProgress(true);
    return Outcome::DONE;
}

bool ResumableDownloader::restartFromZero() {
    _received = 0;
    _total = 0;
    _etag.clear();
    _lastReported = -1;
    reportProgress(true); // tell the UI the bar goes back to zero
    return _sink.restart();
}

void ResumableDownloader::reportProgress(bool force) {
    if (!_progress) {
        return;
    }
    // Throttle to whole percents, or 64 KB steps when the size is unknown.
    int marker =
        _total > 0 ? static_cast<int>((static_cast<uint64_t>(_received) * 100) / _total) : static_cast<int>(_received / 65536);
    if (!force && marker == _lastReported) {
        return;
    }
    _lastReported = marker;
    _progress(_received, _total);
}

bool ResumableDownloader::parseContentRange(const std::string &value, size_t &start, size_t &total) {
    unsigned s = 0;
    unsigned e = 0;
    unsigned t = 0;
    if (sscanf(value.c_str(), "bytes %u-%u/%u", &s, &e, &t) != 3 || e < s || t <= e) {
        return false;
    }
    start = s;
    total = t;
    return true;
}
