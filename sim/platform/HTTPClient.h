// Host shim for HTTPClient.h: a minimal real HTTP/1.1 client over POSIX
// sockets, plain HTTP only (no TLS). The simulator has no wifi stack, but the
// host loopback network works, which lets plugins that push data out (e.g.
// ShotUploadPlugin) be exercised end-to-end against a local server.
#pragma once

#include "WString.h"
#include <arpa/inet.h>
#include <cerrno>
#include <cstdlib>
#include <fcntl.h>
#include <netdb.h>
#include <stdint.h>
#include <string>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>

#define HTTP_CODE_OK 200

class HTTPClient {
  public:
    HTTPClient() = default;
    ~HTTPClient() { end(); }
    HTTPClient(const HTTPClient &) = delete;
    HTTPClient &operator=(const HTTPClient &) = delete;

    bool begin(const String &url) { return begin(url.c_str()); }
    bool begin(const char *url) {
        end();
        _host.clear();
        _path = "/";
        _port = 80;

        // Accept only http:// URLs; anything else fails like a real client would.
        const std::string u(url ? url : "");
        if (u.compare(0, 7, "http://") != 0) {
            return false;
        }
        std::string rest = u.substr(7);
        size_t slash = rest.find('/');
        std::string authority = slash == std::string::npos ? rest : rest.substr(0, slash);
        if (slash != std::string::npos) {
            _path = rest.substr(slash);
        }
        size_t colon = authority.rfind(':');
        if (colon != std::string::npos) {
            _host = authority.substr(0, colon);
            _port = atoi(authority.substr(colon + 1).c_str());
            if (_port <= 0 || _port > 65535) {
                return false;
            }
        } else {
            _host = authority;
        }
        if (_host.empty()) {
            return false;
        }
        _headers.clear();
        return true;
    }

    void end() {
        if (_fd >= 0) {
            close(_fd);
            _fd = -1;
        }
        _lastBody.clear();
    }

    void setTimeout(uint16_t t) { _timeoutMs = t; }
    void setConnectTimeout(int t) { _connectTimeoutMs = t; }
    void addHeader(const String &name, const String &value) { _headers += std::string(name.c_str()) + ": " + value.c_str() + "\r\n"; }

    int GET() { return request("GET", std::string()); }
    int POST(const String &payload) { return request("POST", std::string(payload.c_str(), payload.length())); }

    String getString() { return String(_lastBody.c_str()); }
    String errorToString(int code) {
        (void)code;
        return String("sim socket error");
    }

  private:
    bool connectSocket() {
        struct addrinfo hints{};
        hints.ai_family = AF_UNSPEC;
        hints.ai_socktype = SOCK_STREAM;
        struct addrinfo *res = nullptr;
        if (getaddrinfo(_host.c_str(), std::to_string(_port).c_str(), &hints, &res) != 0 || !res) {
            return false;
        }
        // getaddrinfo may hand out IPv6 (::1) first while the target listens on
        // IPv4 only (or vice versa); try every address until one connects.
        bool ok = false;
        for (struct addrinfo *p = res; p && !ok; p = p->ai_next) {
            _fd = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
            if (_fd < 0) {
                continue;
            }
            // Non-blocking connect so a dead host cannot hang the sim window.
            int flags = fcntl(_fd, F_GETFL, 0);
            fcntl(_fd, F_SETFL, flags | O_NONBLOCK);
            if (connect(_fd, p->ai_addr, p->ai_addrlen) == 0) {
                ok = true;
            } else if (errno == EINPROGRESS) {
                fd_set wset;
                FD_ZERO(&wset);
                FD_SET(_fd, &wset);
                struct timeval tv{};
                tv.tv_sec = _connectTimeoutMs / 1000;
                tv.tv_usec = (_connectTimeoutMs % 1000) * 1000;
                if (select(_fd + 1, nullptr, &wset, nullptr, &tv) == 1) {
                    int err = 0;
                    socklen_t len = sizeof(err);
                    if (getsockopt(_fd, SOL_SOCKET, SO_ERROR, &err, &len) == 0 && err == 0) {
                        ok = true;
                    }
                }
            }
            fcntl(_fd, F_SETFL, flags); // back to blocking for the read
            if (!ok) {
                close(_fd);
                _fd = -1;
            }
        }
        freeaddrinfo(res);
        if (!ok) {
            end();
        }
        return ok;
    }

    int request(const std::string &method, const std::string &payload) {
        _lastBody.clear();
        if (_host.empty() || !connectSocket()) {
            return -1;
        }
        struct timeval tv{};
        tv.tv_sec = _timeoutMs / 1000;
        tv.tv_usec = (_timeoutMs % 1000) * 1000;
        setsockopt(_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

        std::string req = method + " " + _path + " HTTP/1.1\r\nHost: " + _host + "\r\n" + _headers;
        if (_headers.find("Content-Type") == std::string::npos && !payload.empty()) {
            req += "Content-Type: application/x-www-form-urlencoded\r\n";
        }
        req += "Content-Length: " + std::to_string(payload.size()) + "\r\nConnection: close\r\n\r\n" + payload;

        size_t sentTotal = 0;
        while (sentTotal < req.size()) {
            ssize_t sent = send(_fd, req.data() + sentTotal, req.size() - sentTotal, 0);
            if (sent <= 0) {
                end();
                return -1;
            }
            sentTotal += (size_t)sent;
        }
        std::string response;
        char buf[4096];
        ssize_t n;
        while ((n = recv(_fd, buf, sizeof(buf), 0)) > 0) {
            response.append(buf, (size_t)n);
        }
        end();

        // Parse "HTTP/1.1 200 OK" and split headers from body.
        if (response.compare(0, 5, "HTTP/") != 0) {
            return -1;
        }
        size_t sp1 = response.find(' ');
        size_t sp2 = response.find(' ', sp1 + 1);
        if (sp1 == std::string::npos || sp2 == std::string::npos) {
            return -1;
        }
        int code = atoi(response.substr(sp1 + 1, sp2 - sp1 - 1).c_str());
        size_t headerEnd = response.find("\r\n\r\n");
        _lastBody = headerEnd == std::string::npos ? std::string() : response.substr(headerEnd + 4);
        return code;
    }

    std::string _host;
    std::string _path;
    std::string _headers;
    std::string _lastBody;
    int _port = 80;
    int _fd = -1;
    int _timeoutMs = 10000;
    int _connectTimeoutMs = 5000;
};
