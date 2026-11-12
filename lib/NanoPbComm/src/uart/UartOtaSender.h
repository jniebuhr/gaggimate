#ifndef NANOPBCOMM_UART_OTA_SENDER_H
#define NANOPBCOMM_UART_OTA_SENDER_H

#include "../OtaSender.h"
#include "UartOta.h"
#include "UartTransport.h"
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <functional>

// Display side of the UART firmware update (protocol in UartOta.h). run() blocks the calling task until the
// controller has verified the image or the transfer failed; responses arrive on the transport's loop() thread.
class UartOtaSender : public OtaSender {
  public:
    explicit UartOtaSender(UartTransport &transport) : _transport(transport) {}
    ~UartOtaSender() override;

    void begin(); // hook the OTA channel; call once after the transport is set up

    bool isLinkUp() const override { return _transport.isConnected(); }
    bool run(uint32_t size, const uint8_t md5[MD5_LEN], const ReadFn &read, const ProgressFn &progress) override;

  private:
    struct Response {
        uint8_t cmd;
        uint8_t status;
        uint32_t value;
    };

    static constexpr unsigned long RESPONSE_TIMEOUT_MS = 1500; // a chunk that crosses a 4 KB boundary waits on an erase
    static constexpr unsigned long END_TIMEOUT_MS = 10000;     // image verification reads back the whole partition
    static constexpr uint8_t MAX_RETRIES = 8;

    UartTransport &_transport;
    QueueHandle_t _responses = nullptr;
    uint8_t _txBuf[gm_uart_ota::DATA_HEADER_LEN + gm_uart_ota::CHUNK_SIZE]{};

    void onData(const uint8_t *data, size_t length);
    bool transact(const uint8_t *request, size_t length, unsigned long timeoutMs, Response &out);
    void sendAbort();

    static constexpr const char *LOG_TAG = "UartOtaSender";
};

#endif // NANOPBCOMM_UART_OTA_SENDER_H
