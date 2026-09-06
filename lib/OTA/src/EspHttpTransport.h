#ifndef ESP_HTTP_TRANSPORT_H
#define ESP_HTTP_TRANSPORT_H
#ifdef ESP_PLATFORM

#include "DownloadEnv.h"
#include "HttpTransport.h"
#include <esp_http_client.h>
#include <string>

// HttpTransport on esp_http_client + esp-tls with the Arduino certificate bundle.
class EspHttpTransport : public HttpTransport {
  public:
    static constexpr int DEFAULT_TIMEOUT_MS = 15000;

    explicit EspHttpTransport(int timeoutMs = DEFAULT_TIMEOUT_MS) : _timeoutMs(timeoutMs) {}
    ~EspHttpTransport() override { end(); }

    bool begin(const std::string &url) override;
    void setHeader(const char *key, const char *value) override;
    bool open(int &status, int &contentLength) override;
    bool followRedirect() override;
    int read(uint8_t *buffer, size_t len) override;
    bool isComplete() override;
    std::string header(const char *key) override;
    void end() override;

  private:
    static esp_err_t onEvent(esp_http_client_event_t *evt);

    esp_http_client_handle_t _client = nullptr;
    int _timeoutMs;
    std::string _url;
    std::string _etag;
    std::string _contentRange;
};

// DownloadEnv on FreeRTOS, esp_wifi and the internal heap.
class EspDownloadEnv : public DownloadEnv {
  public:
    void delayMs(uint32_t ms) override;
    bool waitForNetwork(uint32_t maxWaitMs) override;
    uint8_t *allocBuffer(size_t size) override;
    void freeBuffer(uint8_t *buffer) override;
};

#endif // ESP_PLATFORM
#endif // ESP_HTTP_TRANSPORT_H
