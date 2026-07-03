// Host implementation behind the ESPAsyncWebServer shim: a minimal non-blocking
// HTTP/1.1 + WebSocket (RFC 6455) server, pumped from the simulator main loop.
#include "ESPAsyncWebServer.h"

#include <algorithm>
#include <arpa/inet.h>
#include <cctype>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>

// ---- registry pumped by gm_web_pump() -------------------------------------
static std::vector<AsyncWebServer *> g_servers;

void gm_web_pump() {
    for (auto *s : g_servers)
        s->pump();
}

// ---- SHA1 + base64 (for the WebSocket handshake) --------------------------
namespace {
struct Sha1 {
    uint32_t h[5];
    uint64_t len = 0;
    uint8_t buf[64];
    size_t bufLen = 0;
    Sha1() {
        h[0] = 0x67452301;
        h[1] = 0xEFCDAB89;
        h[2] = 0x98BADCFE;
        h[3] = 0x10325476;
        h[4] = 0xC3D2E1F0;
    }
    static uint32_t rol(uint32_t v, int b) { return (v << b) | (v >> (32 - b)); }
    void block(const uint8_t *p) {
        uint32_t w[80];
        for (int i = 0; i < 16; i++)
            w[i] = (p[i * 4] << 24) | (p[i * 4 + 1] << 16) | (p[i * 4 + 2] << 8) | p[i * 4 + 3];
        for (int i = 16; i < 80; i++)
            w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
        for (int i = 0; i < 80; i++) {
            uint32_t f, k;
            if (i < 20) {
                f = (b & c) | (~b & d);
                k = 0x5A827999;
            } else if (i < 40) {
                f = b ^ c ^ d;
                k = 0x6ED9EBA1;
            } else if (i < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8F1BBCDC;
            } else {
                f = b ^ c ^ d;
                k = 0xCA62C1D6;
            }
            uint32_t t = rol(a, 5) + f + e + k + w[i];
            e = d;
            d = c;
            c = rol(b, 30);
            b = a;
            a = t;
        }
        h[0] += a;
        h[1] += b;
        h[2] += c;
        h[3] += d;
        h[4] += e;
    }
    void update(const uint8_t *p, size_t n) {
        len += n;
        while (n) {
            size_t take = 64 - bufLen < n ? 64 - bufLen : n;
            memcpy(buf + bufLen, p, take);
            bufLen += take;
            p += take;
            n -= take;
            if (bufLen == 64) {
                block(buf);
                bufLen = 0;
            }
        }
    }
    void final(uint8_t out[20]) {
        uint64_t bits = len * 8;
        uint8_t pad = 0x80;
        update(&pad, 1);
        uint8_t zero = 0;
        while (bufLen != 56)
            update(&zero, 1);
        uint8_t lenbytes[8];
        for (int i = 0; i < 8; i++)
            lenbytes[i] = (bits >> (56 - i * 8)) & 0xff;
        update(lenbytes, 8);
        for (int i = 0; i < 5; i++) {
            out[i * 4] = h[i] >> 24;
            out[i * 4 + 1] = h[i] >> 16;
            out[i * 4 + 2] = h[i] >> 8;
            out[i * 4 + 3] = h[i];
        }
    }
};

std::string base64(const uint8_t *data, size_t len) {
    static const char *t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    for (size_t i = 0; i < len; i += 3) {
        uint32_t n = data[i] << 16;
        if (i + 1 < len)
            n |= data[i + 1] << 8;
        if (i + 2 < len)
            n |= data[i + 2];
        out += t[(n >> 18) & 63];
        out += t[(n >> 12) & 63];
        out += (i + 1 < len) ? t[(n >> 6) & 63] : '=';
        out += (i + 2 < len) ? t[n & 63] : '=';
    }
    return out;
}

void sendAll(int fd, const void *data, size_t len) {
    const char *p = (const char *)data;
    size_t sent = 0;
    while (sent < len) {
        ssize_t n = ::send(fd, p + sent, len - sent, 0);
        if (n > 0) {
            sent += n;
        } else if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) {
            continue;
        } else {
            break;
        }
    }
}

void sendWsFrame(int fd, uint8_t opcode, const uint8_t *data, size_t len) {
    std::string frame;
    frame.push_back((char)(0x80 | opcode));
    if (len < 126) {
        frame.push_back((char)len);
    } else if (len < 65536) {
        frame.push_back((char)126);
        frame.push_back((char)((len >> 8) & 0xff));
        frame.push_back((char)(len & 0xff));
    } else {
        frame.push_back((char)127);
        for (int i = 7; i >= 0; i--)
            frame.push_back((char)((len >> (i * 8)) & 0xff));
    }
    sendAll(fd, frame.data(), frame.size());
    if (len)
        sendAll(fd, data, len);
}
} // namespace

// ---- WebSocket client/socket ----------------------------------------------
void AsyncWebSocketClient::text(AsyncWebSocketMessageBuffer *buffer) {
    if (buffer) {
        sendWsFrame(_fd, WS_TEXT, buffer->get(), buffer->length());
        delete buffer;
    }
}
void AsyncWebSocketClient::text(const String &message) {
    sendWsFrame(_fd, WS_TEXT, (const uint8_t *)message.c_str(), message.length());
}

void AsyncWebSocket::text(uint32_t id, const String &message) {
    for (auto *c : _clients)
        if (c->id() == id)
            c->text(message);
}
void AsyncWebSocket::text(uint32_t id, AsyncWebSocketMessageBuffer *buffer) {
    if (!buffer)
        return;
    for (auto *c : _clients)
        if (c->id() == id)
            sendWsFrame(c->fd(), WS_TEXT, buffer->get(), buffer->length());
    delete buffer;
}
void AsyncWebSocket::textAll(AsyncWebSocketMessageBuffer *buffer) {
    if (!buffer)
        return;
    for (auto *c : _clients)
        sendWsFrame(c->fd(), WS_TEXT, buffer->get(), buffer->length());
    delete buffer;
}
void AsyncWebSocket::closeAll() {
    for (auto *c : _clients) {
        uint8_t close[] = {0x03, 0xe9};
        sendWsFrame(c->fd(), 0x8, close, 2);
        delete c;
    }
    _clients.clear();
}

// ---- response helpers ------------------------------------------------------
static std::string httpReason(int code) {
    switch (code) {
    case 200:
        return "OK";
    case 204:
        return "No Content";
    case 302:
        return "Found";
    case 404:
        return "Not Found";
    case 500:
        return "Internal Server Error";
    default:
        return "OK";
    }
}

static void writeResponse(int fd, AsyncWebServerResponse *resp) {
    const uint8_t *body = resp->_blob ? resp->_blob : (const uint8_t *)resp->_body.data();
    size_t bodyLen = resp->_blob ? resp->_blobLen : resp->_body.size();
    std::string head = "HTTP/1.1 " + std::to_string(resp->_code) + " " + httpReason(resp->_code) + "\r\n";
    head += "Content-Type: " + std::string(resp->_contentType.c_str()) + "\r\n";
    head += "Content-Length: " + std::to_string(bodyLen) + "\r\n";
    for (auto &h : resp->_headers)
        head += std::string(h.first.c_str()) + ": " + std::string(h.second.c_str()) + "\r\n";
    head += "Connection: close\r\n\r\n";
    sendAll(fd, head.data(), head.size());
    if (bodyLen)
        sendAll(fd, body, bodyLen);
}

AsyncWebServerResponse *AsyncWebServerRequest::beginResponse(int code, const String &contentType, const uint8_t *content,
                                                             size_t len) {
    auto *r = new AsyncWebServerResponse();
    r->_code = code;
    r->_contentType = contentType;
    r->_blob = content;
    r->_blobLen = len;
    return r;
}
AsyncWebServerResponse *AsyncWebServerRequest::beginResponse(const String &contentType, size_t len, AwsResponseFiller filler) {
    auto *r = new AsyncWebServerResponse();
    r->_contentType = contentType;
    if (filler && len) {
        r->_body.resize(len);
        filler((uint8_t *)r->_body.data(), len, 0);
    }
    return r;
}
AsyncResponseStream *AsyncWebServerRequest::beginResponseStream(const String &contentType) {
    auto *r = new AsyncResponseStream();
    r->_contentType = contentType;
    return r;
}

void AsyncWebServerRequest::send(AsyncWebServerResponse *response) {
    writeResponse(_fd, response);
    delete response;
}
void AsyncWebServerRequest::send(int code, const String &contentType, const String &body) {
    AsyncWebServerResponse r;
    r._code = code;
    r._contentType = contentType;
    r._body.assign(body.c_str(), body.length());
    writeResponse(_fd, &r);
}
void AsyncWebServerRequest::send(FS &fs, const String &path, const String &contentType) {
    File f = fs.open(path.c_str(), "r");
    if (!f) {
        send(404, "text/plain", "Not found");
        return;
    }
    AsyncWebServerResponse r;
    r._contentType = contentType;
    uint8_t chunk[4096];
    size_t n;
    while ((n = f.read(chunk, sizeof(chunk))) > 0)
        r._body.append((const char *)chunk, n);
    f.close();
    writeResponse(_fd, &r);
}
void AsyncWebServerRequest::redirect(const String &url) {
    AsyncWebServerResponse r;
    r._code = 302;
    r.addHeader("Location", url);
    writeResponse(_fd, &r);
}

// ---- server ----------------------------------------------------------------
AsyncWebServer::~AsyncWebServer() { end(); }

AsyncStaticWebHandler &AsyncWebServer::serveStatic(const char *uri, FS &fs, const char *path) {
    _static.push_back({uri, &fs, path});
    _staticHandlers.emplace_back();
    return _staticHandlers.back();
}

void AsyncWebServer::begin() {
    if (_listenFd >= 0)
        return;
    uint16_t port = _port < 1024 ? 8080 : _port; // avoid needing root for :80
    _listenFd = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(_listenFd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));
    fcntl(_listenFd, F_SETFL, O_NONBLOCK);
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(port);
    if (bind(_listenFd, (sockaddr *)&addr, sizeof(addr)) != 0 || listen(_listenFd, 8) != 0) {
        fprintf(stderr, "[sim-web] failed to listen on %u: %s\n", port, strerror(errno));
        close(_listenFd);
        _listenFd = -1;
        return;
    }
    fprintf(stderr, "[sim-web] WebUI server on http://localhost:%u/\n", port);
    g_servers.push_back(this);
}

void AsyncWebServer::end() {
    if (_listenFd < 0)
        return;
    for (auto &c : _conns)
        close(c.fd);
    _conns.clear();
    close(_listenFd);
    _listenFd = -1;
    g_servers.erase(std::remove(g_servers.begin(), g_servers.end(), this), g_servers.end());
}

void AsyncWebServer::acceptNew() {
    while (true) {
        int fd = accept(_listenFd, nullptr, nullptr);
        if (fd < 0)
            break;
        fcntl(fd, F_SETFL, O_NONBLOCK);
        int one = 1;
        setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
        _conns.push_back(Conn{fd});
    }
}

void AsyncWebServer::pump() {
    if (_listenFd < 0)
        return;
    acceptNew();
    for (size_t i = 0; i < _conns.size();) {
        Conn &c = _conns[i];
        char tmp[8192];
        bool dead = false;
        while (true) {
            ssize_t n = recv(c.fd, tmp, sizeof(tmp), 0);
            if (n > 0) {
                c.inbuf.append(tmp, n);
            } else if (n == 0) {
                dead = true;
                break;
            } else {
                if (errno == EAGAIN || errno == EWOULDBLOCK)
                    break;
                dead = true;
                break;
            }
        }
        if (!dead) {
            if (c.isWs)
                handleWsFrames(c);
            else
                dead = handleHttp(c); // returns true => response sent, close
        }
        if (dead) {
            if (c.isWs && c.client && _ws) {
                _ws->_handler(_ws, c.client, WS_EVT_DISCONNECT, nullptr, nullptr, 0);
                _ws->_clients.erase(std::remove(_ws->_clients.begin(), _ws->_clients.end(), c.client), _ws->_clients.end());
                delete c.client;
            }
            close(c.fd);
            _conns.erase(_conns.begin() + i);
        } else {
            i++;
        }
    }
}

static std::string urlDecode(const std::string &s) {
    std::string out;
    for (size_t i = 0; i < s.size(); i++) {
        if (s[i] == '%' && i + 2 < s.size()) {
            out += (char)strtol(s.substr(i + 1, 2).c_str(), nullptr, 16);
            i += 2;
        } else if (s[i] == '+') {
            out += ' ';
        } else {
            out += s[i];
        }
    }
    return out;
}

// Parse a multipart/form-data body into name=value args (the WebUI posts settings
// as FormData). File parts (with a filename) are skipped — the settings form has none.
static void parseMultipart(const std::string &body, const std::string &boundary, std::map<std::string, std::string> &args) {
    const std::string delim = "--" + boundary;
    size_t pos = 0;
    while (true) {
        size_t start = body.find(delim, pos);
        if (start == std::string::npos)
            break;
        start += delim.size();
        if (body.compare(start, 2, "--") == 0)
            break; // closing delimiter
        if (body.compare(start, 2, "\r\n") == 0)
            start += 2;
        size_t hdrEnd = body.find("\r\n\r\n", start);
        if (hdrEnd == std::string::npos)
            break;
        std::string partHeaders = body.substr(start, hdrEnd - start);
        size_t valStart = hdrEnd + 4;
        size_t next = body.find(delim, valStart);
        if (next == std::string::npos)
            break;
        size_t valEnd = (next >= 2 && body.compare(next - 2, 2, "\r\n") == 0) ? next - 2 : next;

        size_t np = partHeaders.find("name=\"");
        if (np != std::string::npos && partHeaders.find("filename=\"") == std::string::npos) {
            np += 6;
            size_t ne = partHeaders.find('"', np);
            if (ne != std::string::npos)
                args[partHeaders.substr(np, ne - np)] = body.substr(valStart, valEnd - valStart);
        }
        pos = next;
    }
}

bool AsyncWebServer::handleHttp(Conn &c) {
    size_t headerEnd = c.inbuf.find("\r\n\r\n");
    if (headerEnd == std::string::npos)
        return false; // wait for more
    std::string header = c.inbuf.substr(0, headerEnd);

    // Request line
    size_t lineEnd = header.find("\r\n");
    std::string reqLine = header.substr(0, lineEnd);
    size_t sp1 = reqLine.find(' '), sp2 = reqLine.find(' ', sp1 + 1);
    std::string method = reqLine.substr(0, sp1);
    std::string target = reqLine.substr(sp1 + 1, sp2 - sp1 - 1);

    // Headers (lowercased keys)
    std::map<std::string, std::string> headers;
    size_t pos = lineEnd + 2;
    while (pos < header.size()) {
        size_t e = header.find("\r\n", pos);
        if (e == std::string::npos)
            e = header.size();
        std::string h = header.substr(pos, e - pos);
        size_t colon = h.find(':');
        if (colon != std::string::npos) {
            std::string k = h.substr(0, colon), v = h.substr(colon + 1);
            for (auto &ch : k)
                ch = tolower(ch);
            while (!v.empty() && (v[0] == ' '))
                v.erase(0, 1);
            headers[k] = v;
        }
        pos = e + 2;
    }

    // Body (per Content-Length)
    size_t bodyStart = headerEnd + 4;
    size_t contentLen = headers.count("content-length") ? strtoul(headers["content-length"].c_str(), nullptr, 10) : 0;
    if (c.inbuf.size() < bodyStart + contentLen)
        return false; // wait for full body
    std::string body = c.inbuf.substr(bodyStart, contentLen);

    // WebSocket upgrade?
    if (_ws && headers.count("upgrade") && headers["upgrade"].find("websocket") != std::string::npos &&
        headers.count("sec-websocket-key")) {
        std::string accept = headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        Sha1 sha;
        sha.update((const uint8_t *)accept.data(), accept.size());
        uint8_t digest[20];
        sha.final(digest);
        std::string resp = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                           "Sec-WebSocket-Accept: " +
                           base64(digest, 20) + "\r\n\r\n";
        sendAll(c.fd, resp.data(), resp.size());
        c.isWs = true;
        static uint32_t s_nextId = 1;
        c.client = new AsyncWebSocketClient(s_nextId++, c.fd);
        _ws->_clients.push_back(c.client);
        _ws->_handler(_ws, c.client, WS_EVT_CONNECT, nullptr, nullptr, 0);
        c.inbuf.erase(0, bodyStart + contentLen);
        return false; // keep the connection open as a websocket
    }

    // Split path/query
    std::string path = target, query;
    size_t q = target.find('?');
    if (q != std::string::npos) {
        path = target.substr(0, q);
        query = target.substr(q + 1);
    }

    AsyncWebServerRequest req(c.fd, this);
    req._url = String(path.c_str());
    req._body = body;
    req._method = method == "POST" ? HTTP_POST : method == "PUT" ? HTTP_PUT : method == "DELETE" ? HTTP_DELETE : HTTP_GET;
    auto parseArgs = [&](const std::string &s) {
        size_t i = 0;
        while (i < s.size()) {
            size_t amp = s.find('&', i);
            if (amp == std::string::npos)
                amp = s.size();
            std::string kv = s.substr(i, amp - i);
            size_t eq = kv.find('=');
            if (eq != std::string::npos)
                req._args[urlDecode(kv.substr(0, eq))] = urlDecode(kv.substr(eq + 1));
            i = amp + 1;
        }
    };
    parseArgs(query);
    const std::string ctype = headers.count("content-type") ? headers["content-type"] : "";
    if (ctype.find("x-www-form-urlencoded") != std::string::npos) {
        parseArgs(body);
    } else if (ctype.find("multipart/form-data") != std::string::npos) {
        size_t bp = ctype.find("boundary=");
        if (bp != std::string::npos)
            parseMultipart(body, ctype.substr(bp + 9), req._args);
    }

    dispatch(c, req);
    return true; // Connection: close
}

void AsyncWebServer::dispatch(Conn &c, AsyncWebServerRequest &req) {
    std::string path(req._url.c_str());
    for (auto &r : _routes) {
        if ((r.method == HTTP_ANY || (r.method & req._method)) && r.uri == path) {
            r.handler(&req);
            return;
        }
    }
    for (auto &s : _static) {
        if (path.rfind(s.uri, 0) == 0) { // prefix match
            std::string rel = path.substr(s.uri.size());
            req.send(*s.fs, String((s.path + rel).c_str()), "application/octet-stream");
            return;
        }
    }
    if (_notFound)
        _notFound(&req);
    else
        req.send(404, "text/plain", "Not found");
}

void AsyncWebServer::handleWsFrames(Conn &c) {
    while (true) {
        std::string &b = c.inbuf;
        if (b.size() < 2)
            return;
        const uint8_t *p = (const uint8_t *)b.data();
        uint8_t opcode = p[0] & 0x0f;
        bool fin = p[0] & 0x80;
        bool masked = p[1] & 0x80;
        uint64_t len = p[1] & 0x7f;
        size_t off = 2;
        if (len == 126) {
            if (b.size() < 4)
                return;
            len = (p[2] << 8) | p[3];
            off = 4;
        } else if (len == 127) {
            if (b.size() < 10)
                return;
            len = 0;
            for (int i = 0; i < 8; i++)
                len = (len << 8) | p[2 + i];
            off = 10;
        }
        uint8_t mask[4] = {0, 0, 0, 0};
        if (masked) {
            if (b.size() < off + 4)
                return;
            memcpy(mask, p + off, 4);
            off += 4;
        }
        if (b.size() < off + len)
            return; // wait for full payload

        std::vector<uint8_t> payload(len);
        for (uint64_t i = 0; i < len; i++)
            payload[i] = p[off + i] ^ mask[i & 3];
        b.erase(0, off + (size_t)len);

        if (opcode == 0x8) { // close
            uint8_t close[] = {0x03, 0xe9};
            sendWsFrame(c.fd, 0x8, close, 2);
            return;
        } else if (opcode == 0x9) { // ping -> pong
            sendWsFrame(c.fd, 0xA, payload.data(), payload.size());
        } else if (opcode == 0x1 || opcode == 0x2 || opcode == 0x0) {
            AwsFrameInfo info;
            info.opcode = opcode == 0x2 ? WS_BINARY : WS_TEXT;
            info.final = fin;
            info.index = 0;
            info.len = len;
            if (_ws && _ws->_handler)
                _ws->_handler(_ws, c.client, WS_EVT_DATA, &info, payload.data(), payload.size());
        }
    }
}
