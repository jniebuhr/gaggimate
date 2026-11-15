#ifndef NANOPBCOMM_UART_OTA_RECEIVER_H
#define NANOPBCOMM_UART_OTA_RECEIVER_H

#include "UartOta.h"
#include "UartTransport.h"
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <functional>

// Controller side of the UART firmware update (protocol in UartOta.h). Writes straight into the next OTA partition via
// Update, so a failed transfer leaves the running image untouched. Flash work runs on its own task so the transport
// keeps pumping keepalives and protocol frames while a sector erases.
class UartOtaReceiver {
  public:
    using StartCallback = std::function<void()>;

    explicit UartOtaReceiver(UartTransport &transport) : _transport(transport) {}

    void begin(); // hook the OTA channel + start the worker task

    bool isUpdating() const { return _updating; }
    // Fired on the worker task when an update starts; put the machine in a safe state here.
    void onStart(StartCallback cb) { _startCb = std::move(cb); }

  private:
    struct Request {
        uint16_t length;
        uint8_t data[gm_uart_ota::DATA_HEADER_LEN + gm_uart_ota::CHUNK_SIZE];
    };

    static constexpr uint32_t TASK_STACK = 6144;
    static constexpr UBaseType_t TASK_PRIORITY = 2;
    static constexpr unsigned long IDLE_ABORT_MS = 30000;  // display vanished mid-transfer
    static constexpr unsigned long REBOOT_DELAY_MS = 1500; // let the END response (and a possible repeat) go out

    UartTransport &_transport;
    QueueHandle_t _requests = nullptr;
    StartCallback _startCb;

    volatile bool _updating = false;
    bool _finished = false; // image verified, reboot pending
    uint32_t _size = 0;
    uint32_t _written = 0;
    uint32_t _lastChunkLen = 0;
    unsigned long _finishedAt = 0;

    static void taskFn(void *arg);
    void onData(const uint8_t *data, size_t length);
    void handle(const Request &req);
    void handleBegin(const uint8_t *data, size_t length);
    void handleData(const uint8_t *data, size_t length);
    void handleEnd();
    void abortUpdate();
    void respond(uint8_t cmd, uint8_t status, uint32_t value);

    static constexpr const char *LOG_TAG = "UartOtaReceiver";
};

#endif // NANOPBCOMM_UART_OTA_RECEIVER_H
