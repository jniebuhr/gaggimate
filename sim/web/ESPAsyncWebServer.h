// Host shim for ESPAsyncWebServer, backed by a tiny non-blocking HTTP/1.1 +
// WebSocket server (ESPAsyncWebServer.cpp). It is pumped cooperatively from the
// simulator main loop (gm_web_pump), so all handlers run on the main thread and
// never race the firmware. Only the subset WebUIPlugin uses is implemented.
#pragma once

#include "FS.h"
#include "Print.h"
#include "WString.h"
#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

// HTTP method bitmask (matches ESPAsyncWebServer values closely enough).
enum WebRequestMethod {
    HTTP_GET = 0b00000001,
    HTTP_POST = 0b00000010,
    HTTP_DELETE = 0b00000100,
    HTTP_PUT = 0b00001000,
    HTTP_PATCH = 0b00010000,
    HTTP_HEAD = 0b00100000,
    HTTP_OPTIONS = 0b01000000,
    HTTP_ANY = 0b01111111,
};

// WebSocket event + frame types.
enum AwsEventType { WS_EVT_CONNECT, WS_EVT_DISCONNECT, WS_EVT_DATA, WS_EVT_PONG, WS_EVT_ERROR };
enum { WS_CONTINUATION = 0x0, WS_TEXT = 0x1, WS_BINARY = 0x2 };

struct AwsFrameInfo {
    uint8_t opcode = WS_TEXT;
    bool final = true;
    uint64_t index = 0;
    uint64_t len = 0;
};

class AsyncWebServerResponse {
  public:
    virtual ~AsyncWebServerResponse() = default;
    void addHeader(const String &name, const String &value) { _headers.emplace_back(name, value); }
    void setCode(int code) { _code = code; }

    int _code = 200;
    String _contentType = "text/plain";
    std::string _body;
    std::vector<std::pair<String, String>> _headers;
    const uint8_t *_blob = nullptr; // optional zero-copy body (embedded assets)
    size_t _blobLen = 0;
};

// Print-backed streaming response (serializeJson writes into _body).
class AsyncResponseStream : public AsyncWebServerResponse, public Print {
  public:
    size_t write(uint8_t c) override {
        _body.push_back((char)c);
        return 1;
    }
    size_t write(const uint8_t *buffer, size_t size) override {
        _body.append((const char *)buffer, size);
        return size;
    }
};

using AwsResponseFiller = std::function<size_t(uint8_t *, size_t, size_t)>;

class AsyncWebServer;

class AsyncWebServerRequest {
  public:
    AsyncWebServerRequest(int fd, AsyncWebServer *server) : _fd(fd), _server(server) {}

    const String &url() const { return _url; }
    int method() const { return _method; }
    bool hasArg(const char *name) const { return _args.count(name) > 0; }
    bool hasArg(const String &name) const { return hasArg(name.c_str()); }
    String arg(const char *name) const {
        auto it = _args.find(name);
        return it == _args.end() ? String() : String(it->second.c_str());
    }
    String arg(const String &name) const { return arg(name.c_str()); }

    AsyncWebServerResponse *beginResponse(int code, const String &contentType, const uint8_t *content, size_t len);
    AsyncWebServerResponse *beginResponse(const String &contentType, size_t len, AwsResponseFiller callback);
    AsyncResponseStream *beginResponseStream(const String &contentType);

    void send(AsyncWebServerResponse *response);
    void send(int code, const String &contentType = "text/plain", const String &body = String());
    void send(FS &fs, const String &path, const String &contentType);
    void redirect(const String &url);

    // Populated by the server before dispatch.
    String _url;
    int _method = HTTP_GET;
    std::map<std::string, std::string> _args;
    std::string _body;
    int _fd;
    AsyncWebServer *_server;
};

using ArRequestHandlerFunction = std::function<void(AsyncWebServerRequest *)>;

class AsyncWebSocketMessageBuffer {
  public:
    explicit AsyncWebSocketMessageBuffer(size_t n) : _data(n) {}
    uint8_t *get() { return _data.data(); }
    size_t length() const { return _data.size(); }

  private:
    std::vector<uint8_t> _data;
};

class AsyncWebSocketClient {
  public:
    AsyncWebSocketClient(uint32_t id, int fd) : _id(id), _fd(fd) {}
    uint32_t id() const { return _id; }
    int fd() const { return _fd; }
    void setCloseClientOnQueueFull(bool) {}
    void text(AsyncWebSocketMessageBuffer *buffer);
    void text(const String &message);

  private:
    uint32_t _id;
    int _fd;
};

using AwsEventHandler =
    std::function<void(class AsyncWebSocket *, AsyncWebSocketClient *, AwsEventType, void *, uint8_t *, size_t)>;

class AsyncWebSocket {
  public:
    explicit AsyncWebSocket(const String &url) : _url(url) {}
    const String &url() const { return _url; }
    void onEvent(AwsEventHandler handler) { _handler = std::move(handler); }
    AsyncWebSocketMessageBuffer *makeBuffer(size_t size) { return new AsyncWebSocketMessageBuffer(size); }
    void text(uint32_t id, const String &message);
    void text(uint32_t id, AsyncWebSocketMessageBuffer *buffer);
    void textAll(AsyncWebSocketMessageBuffer *buffer);
    void cleanupClients() {}
    void closeAll();
    const std::vector<AsyncWebSocketClient *> &getClients() const { return _clients; }

    // Used by the server implementation.
    AwsEventHandler _handler;
    std::vector<AsyncWebSocketClient *> _clients;
    String _url;
};

// Returned by serveStatic(); only setCacheControl() is used.
class AsyncStaticWebHandler {
  public:
    AsyncStaticWebHandler &setCacheControl(const char *) { return *this; }
};

class AsyncWebServer {
  public:
    explicit AsyncWebServer(uint16_t port) : _port(port) {}
    ~AsyncWebServer();

    void on(const char *uri, ArRequestHandlerFunction handler) { _routes.push_back({HTTP_ANY, uri, std::move(handler)}); }
    void on(const char *uri, WebRequestMethod method, ArRequestHandlerFunction handler) {
        _routes.push_back({(int)method, uri, std::move(handler)});
    }
    void onNotFound(ArRequestHandlerFunction handler) { _notFound = std::move(handler); }
    void addHandler(AsyncWebSocket *ws) { _ws = ws; }
    AsyncStaticWebHandler &serveStatic(const char *uri, FS &fs, const char *path);

    void begin();
    void end();

    void pump(); // process pending sockets (called from gm_web_pump)

  private:
    struct Route {
        int method;
        std::string uri;
        ArRequestHandlerFunction handler;
    };
    struct StaticRoute {
        std::string uri;
        FS *fs;
        std::string path;
    };

    uint16_t _port;
    int _listenFd = -1;
    std::vector<Route> _routes;
    std::vector<StaticRoute> _static;
    std::vector<AsyncStaticWebHandler> _staticHandlers;
    ArRequestHandlerFunction _notFound;
    AsyncWebSocket *_ws = nullptr;

    struct Conn {
        int fd;
        std::string inbuf;
        bool isWs = false;
        AsyncWebSocketClient *client = nullptr;
    };
    std::vector<Conn> _conns;

    void acceptNew();
    void serviceConn(Conn &c);
    bool handleHttp(Conn &c); // returns true if a full request was handled
    void handleWsFrames(Conn &c);
    void dispatch(Conn &c, AsyncWebServerRequest &req);
};

// Pump every running AsyncWebServer once (call from the simulator main loop).
void gm_web_pump();
