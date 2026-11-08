// Test-only HttpTransport over plain HTTP/1.1 POSIX sockets, mirroring the esp_http_client adapter's contract.
#pragma once

#include "HttpTransport.h"
#include <arpa/inet.h>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <map>
#include <netdb.h>
#include <netinet/in.h>
#include <string>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

#ifdef MSG_NOSIGNAL
#define OTA_SEND_FLAGS MSG_NOSIGNAL
#else
#define OTA_SEND_FLAGS 0
#endif

struct CaseInsensitiveLess {
    bool operator()(const std::string &a, const std::string &b) const { return strcasecmp(a.c_str(), b.c_str()) < 0; }
};

class PosixHttpTransport : public HttpTransport {
  public:
    explicit PosixHttpTransport(int timeoutMs = 1000) : _timeoutMs(timeoutMs) {}
    ~PosixHttpTransport() override { end(); }

    bool begin(const std::string &url) override {
        end();
        _reqHeaders.clear();
        return parseUrl(url, _host, _port, _path);
    }

    void setHeader(const char *key, const char *value) override { _reqHeaders[key] = value; }

    bool open(int &status, int &contentLength) override {
        _respHeaders.clear();
        _pending.clear();
        _pendingOffset = 0;
        _bodyRead = 0;
        _bodyExpected = -1;
        if (!connect()) {
            return false;
        }
        std::string req = "GET " + _path + " HTTP/1.1\r\nHost: " + _host + "\r\nConnection: close\r\n";
        for (const auto &h : _reqHeaders) {
            req += h.first + ": " + h.second + "\r\n";
        }
        req += "\r\n";
        if (!sendAll(req)) {
            closeSocket();
            return false;
        }
        std::string raw;
        size_t headerEnd = std::string::npos;
        while ((headerEnd = raw.find("\r\n\r\n")) == std::string::npos) {
            char buf[2048];
            ssize_t n = ::recv(_fd, buf, sizeof(buf), 0);
            if (n <= 0 || raw.size() > 65536) {
                closeSocket();
                return false;
            }
            raw.append(buf, static_cast<size_t>(n));
        }
        std::string head = raw.substr(0, headerEnd);
        _pending.assign(raw.begin() + static_cast<long>(headerEnd) + 4, raw.end());
        size_t sp = head.find(' ');
        if (sp == std::string::npos) {
            closeSocket();
            return false;
        }
        status = atoi(head.c_str() + sp + 1);
        size_t pos = head.find("\r\n");
        while (pos != std::string::npos) {
            size_t next = head.find("\r\n", pos + 2);
            std::string line = head.substr(pos + 2, next == std::string::npos ? std::string::npos : next - pos - 2);
            size_t colon = line.find(':');
            if (colon != std::string::npos) {
                std::string value = line.substr(colon + 1);
                size_t first = value.find_first_not_of(' ');
                _respHeaders[line.substr(0, colon)] = first == std::string::npos ? "" : value.substr(first);
            }
            pos = next;
        }
        auto cl = _respHeaders.find("Content-Length");
        if (cl != _respHeaders.end()) {
            _bodyExpected = atol(cl->second.c_str());
        }
        contentLength = _bodyExpected >= 0 ? static_cast<int>(_bodyExpected) : 0;
        return true;
    }

    bool followRedirect() override {
        std::string location = header("Location");
        if (location.empty()) {
            return false;
        }
        closeSocket();
        if (location[0] == '/') {
            _path = location;
            return true;
        }
        return parseUrl(location, _host, _port, _path);
    }

    int read(uint8_t *buffer, size_t len) override {
        if (_pendingOffset < _pending.size()) {
            size_t n = std::min(len, _pending.size() - _pendingOffset);
            memcpy(buffer, _pending.data() + _pendingOffset, n);
            _pendingOffset += n;
            _bodyRead += static_cast<long>(n);
            return static_cast<int>(n);
        }
        if (_bodyExpected >= 0 && _bodyRead >= _bodyExpected) {
            return 0;
        }
        if (_fd < 0) {
            return 0;
        }
        ssize_t n = ::recv(_fd, buffer, len, 0);
        if (n > 0) {
            _bodyRead += n;
            return static_cast<int>(n);
        }
        if (n == 0) {
            return 0; // peer closed
        }
        return (errno == EAGAIN || errno == EWOULDBLOCK) ? 0 : -1; // timeout counts as a stall
    }

    bool isComplete() override { return _bodyExpected >= 0 && _bodyRead == _bodyExpected; }

    std::string header(const char *key) override {
        auto it = _respHeaders.find(key);
        return it == _respHeaders.end() ? "" : it->second;
    }

    void end() override { closeSocket(); }

  private:
    static bool parseUrl(const std::string &url, std::string &host, int &port, std::string &path) {
        const std::string prefix = "http://";
        if (url.compare(0, prefix.size(), prefix) != 0) {
            return false;
        }
        std::string rest = url.substr(prefix.size());
        size_t slash = rest.find('/');
        std::string hostport = slash == std::string::npos ? rest : rest.substr(0, slash);
        path = slash == std::string::npos ? "/" : rest.substr(slash);
        size_t colon = hostport.find(':');
        host = colon == std::string::npos ? hostport : hostport.substr(0, colon);
        port = colon == std::string::npos ? 80 : atoi(hostport.c_str() + colon + 1);
        return !host.empty();
    }

    bool connect() {
        struct addrinfo hints = {};
        hints.ai_family = AF_UNSPEC;
        hints.ai_socktype = SOCK_STREAM;
        struct addrinfo *res = nullptr;
        if (getaddrinfo(_host.c_str(), std::to_string(_port).c_str(), &hints, &res) != 0) {
            return false;
        }
        for (auto *p = res; p != nullptr; p = p->ai_next) {
            _fd = ::socket(p->ai_family, p->ai_socktype, p->ai_protocol);
            if (_fd < 0) {
                continue;
            }
            struct timeval tv;
            tv.tv_sec = _timeoutMs / 1000;
            tv.tv_usec = (_timeoutMs % 1000) * 1000;
            setsockopt(_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
            setsockopt(_fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
#ifdef SO_NOSIGPIPE
            int one = 1;
            setsockopt(_fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one));
#endif
            if (::connect(_fd, p->ai_addr, p->ai_addrlen) == 0) {
                break;
            }
            ::close(_fd);
            _fd = -1;
        }
        freeaddrinfo(res);
        return _fd >= 0;
    }

    bool sendAll(const std::string &data) {
        size_t off = 0;
        while (off < data.size()) {
            ssize_t n = ::send(_fd, data.data() + off, data.size() - off, OTA_SEND_FLAGS);
            if (n <= 0) {
                return false;
            }
            off += static_cast<size_t>(n);
        }
        return true;
    }

    void closeSocket() {
        if (_fd >= 0) {
            ::close(_fd);
            _fd = -1;
        }
    }

    int _timeoutMs;
    int _fd = -1;
    std::string _host;
    int _port = 80;
    std::string _path;
    std::map<std::string, std::string> _reqHeaders;
    std::map<std::string, std::string, CaseInsensitiveLess> _respHeaders;
    std::string _pending;
    size_t _pendingOffset = 0;
    long _bodyRead = 0;
    long _bodyExpected = -1;
};
