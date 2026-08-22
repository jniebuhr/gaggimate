#ifndef NANOPBCOMM_UART_TRANSPORT_H
#define NANOPBCOMM_UART_TRANSPORT_H

#include "../Transport.h"
#include "UartFraming.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// Serial transport, one class for both ends (no server/client split); frames per UartFraming.h, CRC guards the raw UART.
// "Connected" = valid frame heard within LINK_TIMEOUT_MS; loop() always keepalives so two idle ends can find each other.
//
// No RX interrupt like NimBLE, so loop() has to be called regularly (same place
// as Endpoint::loop()). Caller sets up the serial port; we just take a Stream.
class UartTransport : public Transport {
  public:
    explicit UartTransport(Stream &stream) : _stream(stream) {}
    ~UartTransport() override;

    void begin(); // reset state; port must already be configured by the caller
    void loop();  // drain RX, dispatch frames, expire the link, send keepalives

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override { return _connected; }

  private:
    static constexpr size_t MAX_DATAGRAM = 256; // == Endpoint::BUFFER_SIZE; bigger is dropped
    static constexpr size_t CRC_LEN = 2;
    static constexpr size_t DECODE_CAP = MAX_DATAGRAM + CRC_LEN;
    static constexpr size_t ENCODED_CAP = gm_uart::cobsMaxEncodedLen(DECODE_CAP) + 4;

    static constexpr unsigned long KEEPALIVE_INTERVAL_MS = 250;
    static constexpr unsigned long LINK_TIMEOUT_MS = 1000;

    Stream &_stream;
    SemaphoreHandle_t _txMutex = nullptr;

    bool _connected = false;
    unsigned long _lastRxMs = 0;
    unsigned long _lastKeepaliveMs = 0;

    // RX reassembly, only touched from loop().
    uint8_t _rxBuf[ENCODED_CAP]{};
    size_t _rxLen = 0;
    bool _rxOverflow = false;
    uint8_t _decodeBuf[DECODE_CAP]{};

    // TX scratch, guarded by _txMutex.
    uint8_t _txStage[DECODE_CAP]{};
    uint8_t _txEncoded[ENCODED_CAP]{};

    void processByte(uint8_t byte);
    void handleFrame(const uint8_t *block, size_t blockLen);
    bool writeDatagram(const uint8_t *data, size_t length);
    void markAlive();
    void setConnected(bool connected);

    void lockTx() {
        if (_txMutex)
            xSemaphoreTake(_txMutex, portMAX_DELAY);
    }
    void unlockTx() {
        if (_txMutex)
            xSemaphoreGive(_txMutex);
    }

    static constexpr const char *LOG_TAG = "UartTransport";
};

#endif // NANOPBCOMM_UART_TRANSPORT_H
