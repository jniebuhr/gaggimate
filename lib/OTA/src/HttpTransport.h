#ifndef OTA_HTTP_TRANSPORT_H
#define OTA_HTTP_TRANSPORT_H

#include <cstddef>
#include <cstdint>
#include <string>

// One HTTP client used for a single download attempt; implemented on esp_http_client and, for tests, POSIX sockets.
class HttpTransport {
  public:
    virtual ~HttpTransport() = default;

    // Creates the client for one attempt at the given URL; false means no client could be created.
    virtual bool begin(const std::string &url) = 0;
    virtual void setHeader(const char *key, const char *value) = 0;
    // Connects, sends the request and reads the response headers; false on any connection failure.
    virtual bool open(int &status, int &contentLength) = 0;
    // Switches the client to the Location of the last response and closes the connection; false if there is none.
    virtual bool followRedirect() = 0;
    // >0 body bytes, 0 when the body is complete or the connection stalled / closed (see isComplete), <0 on error.
    virtual int read(uint8_t *buffer, size_t len) = 0;
    virtual bool isComplete() = 0;
    // Captured response header value, empty if the last response did not carry it.
    virtual std::string header(const char *key) = 0;
    // Closes the connection and releases the client.
    virtual void end() = 0;
};

#endif // OTA_HTTP_TRANSPORT_H
