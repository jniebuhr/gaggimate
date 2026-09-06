#ifndef RESUMABLE_DOWNLOADER_H
#define RESUMABLE_DOWNLOADER_H

#include "DownloadEnv.h"
#include "HttpTransport.h"
#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>

// Receives the body in order; write() returns false to abort, restart() discards everything received so far.
struct DownloadSink {
    std::function<bool(const uint8_t *data, size_t len)> write;
    std::function<bool()> restart;
};

using download_progress_t = std::function<void(size_t received, size_t total)>;

struct DownloadPolicy {
    int maxAttempts = 8;       // consecutive attempts that delivered nothing new before giving up
    int maxTotalAttempts = 64; // hard cap, so a link that trickles a few bytes per connection still ends
    int maxRedirects = 5;
    uint32_t initialBackoffMs = 2000;
    uint32_t maxBackoffMs = 30000;
    uint32_t networkWaitMs = 60000;
    size_t chunkSize = 4096;
};

// Download that retries dropped connections and resumes via Range / If-Range; transport and platform are injected.
class ResumableDownloader {
  public:
    ResumableDownloader(HttpTransport &transport, DownloadEnv &env, std::string url, DownloadSink sink,
                        download_progress_t progress = nullptr, DownloadPolicy policy = DownloadPolicy());

    bool run();
    size_t received() const { return _received; }
    size_t total() const { return _total; }
    int attempts() const { return _attempts; }
    const std::string &etag() const { return _etag; }

    // Parses "bytes <start>-<end>/<total>"; false for anything else, including "bytes */<total>".
    static bool parseContentRange(const std::string &value, size_t &start, size_t &total);

  private:
    enum class Outcome { DONE, RETRY, FATAL };

    Outcome runAttempt(uint8_t *buffer);
    bool openWithRedirects(int &status, int &contentLength);
    Outcome consumeResponse(int status, int contentLength, uint8_t *buffer);
    Outcome readBody(uint8_t *buffer);
    bool restartFromZero();
    void reportProgress(bool force);

    HttpTransport &_transport;
    DownloadEnv &_env;
    std::string _url;
    DownloadSink _sink;
    download_progress_t _progress;
    DownloadPolicy _policy;
    std::string _etag; // validator sent as If-Range, taken from the first full response
    size_t _received = 0;
    size_t _total = 0;
    int _attempts = 0;
    bool _progressed = false; // the current attempt delivered at least one new byte
    int _lastReported = -1;
};

#endif // RESUMABLE_DOWNLOADER_H
