#ifndef NANOPBCOMM_UART_TRANSPORT_H
#define NANOPBCOMM_UART_TRANSPORT_H

#include "../Transport.h"
#include "UartFraming.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// Serial transport, one class for both ends (no server/client split); frames per UartFraming.h, CRC guards the raw UART.
// "Connected" = both ends hear each other: a valid frame within LINK_TIMEOUT_MS plus the peer's keepalive confirming ours.
// Every frame carries a channel byte: CHANNEL_PROTOCOL feeds the Endpoint, CHANNEL_OTA the controller firmware update.
//
// Not interrupt-driven, so loop() has to be called regularly (same place as
// Endpoint::loop()). Caller sets up the serial port; we just take a Stream.
class UartTransport : public Transport {
  public:
    enum Channel : uint8_t {
        CHANNEL_PROTOCOL = 0, // nanopb Frames, delivered through Transport::onData
        CHANNEL_OTA = 1,      // controller firmware update, see UartOta.h
        CHANNEL_COUNT
    };

    // Largest payload one frame can carry (channel byte not included); sized for an OTA chunk plus its header.
    static constexpr size_t MAX_DATAGRAM = 1040;
    // Largest protocol datagram; equals Endpoint::BUFFER_SIZE.
    static constexpr size_t MAX_PROTOCOL_DATAGRAM = 256;

    explicit UartTransport(Stream &stream) : _stream(stream) {}
    ~UartTransport() override;

    void begin(); // reset state; port must already be configured by the caller
    void loop();  // drain RX, dispatch frames, expire the link, send keepalives

    bool send(const uint8_t *data, size_t length) override { return sendOn(CHANNEL_PROTOCOL, data, length); }
    bool sendOn(Channel channel, const uint8_t *data, size_t length);
    bool isConnected() const override { return _connected; }
    size_t maxDatagram() const override { return MAX_PROTOCOL_DATAGRAM; }

    // Receive callback for a non-protocol channel; runs on the thread calling loop().
    void onChannelData(Channel channel, DataCallback cb);

    // No link to drop on a wire, so go silent (no keepalives, RX ignored) long enough for the peer to time out too.
    void disconnect();

  private:
    static constexpr size_t CHANNEL_LEN = 1;
    static constexpr size_t CRC_LEN = 2;
    static constexpr size_t DECODE_CAP = CHANNEL_LEN + MAX_DATAGRAM + CRC_LEN;
    static constexpr size_t ENCODED_CAP = gm_uart::cobsMaxEncodedLen(DECODE_CAP) + 4;

    static constexpr unsigned long KEEPALIVE_INTERVAL_MS = 250;
    // Faster while no link is up, so a freshly booted peer is found within a few frames.
    static constexpr unsigned long KEEPALIVE_SEARCH_INTERVAL_MS = 50;
    static constexpr unsigned long LINK_TIMEOUT_MS = 1000;
    static constexpr unsigned long DISCONNECT_HOLD_MS = 2 * LINK_TIMEOUT_MS;
    static constexpr unsigned long DROP_LOG_INTERVAL_MS = 1000;
    // Keepalive flag: the sender currently receives valid frames from us.
    static constexpr uint8_t KEEPALIVE_HEARS_PEER = 0x01;

    Stream &_stream;
    SemaphoreHandle_t _txMutex = nullptr;
    DataCallback _channelCbs[CHANNEL_COUNT]{};

    bool _connected = false;
    bool _hearing = false;      // valid frame within LINK_TIMEOUT_MS
    bool _peerHears = false;    // peer confirmed it receives us
    bool _keepaliveDue = false; // answer a newly heard peer without waiting for the interval
    // Line noise (a peer's boot console) arrives as a flood of bad frames; count them and report once a second.
    uint32_t _dropped = 0;
    unsigned long _lastDropLogMs = 0;
    unsigned long _lastRxMs = 0;
    unsigned long _lastKeepaliveMs = 0;
    volatile bool _muted = false;
    volatile unsigned long _mutedAt = 0;

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
    bool writeFrame(const uint8_t *header, size_t headerLen, const uint8_t *data, size_t length);
    void sendKeepalive();
    void dropLink();
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
