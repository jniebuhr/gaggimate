#ifndef NANOPBCOMM_TRANSPORT_H
#define NANOPBCOMM_TRANSPORT_H

#include <Arduino.h>
#include <functional>

/**
 * Abstract datagram transport.
 *
 * The Endpoint sits on top of this and only ever deals in whole datagrams --
 * one nanopb `Frame` per datagram. Concrete transports are responsible for
 * preserving datagram boundaries: BLE gets that for free (one
 * write/notification == one datagram), a future UART transport would add its
 * own length-delimiting/framing internally and still hand whole datagrams up.
 *
 * Keeping this interface narrow is what lets the protocol/session layer stay
 * transport-agnostic and swappable (BLE today, UART tomorrow).
 */
class Transport {
  public:
    using DataCallback = std::function<void(const uint8_t *data, size_t length)>;
    using ConnectionCallback = std::function<void(bool connected)>;

    virtual ~Transport() = default;

    // Send one complete datagram. Returns false if it could not be handed off.
    virtual bool send(const uint8_t *data, size_t length) = 0;

    // Identify the currently usable connection. Stateful transports override
    // these two methods so a datagram prepared for a retired connection cannot
    // be delivered after an intervening reconnect.
    virtual uint32_t connectionSession() const { return 0; }
    virtual bool sendForSession(const uint8_t *data, size_t length, uint32_t session) {
        (void)session;
        return send(data, length);
    }

    // Whether the link is currently usable.
    virtual bool isConnected() const = 0;

    void onData(DataCallback cb) { _dataCb = std::move(cb); }
    void onConnectionChange(ConnectionCallback cb) { _connCb = std::move(cb); }

  protected:
    void emitData(const uint8_t *data, size_t length) const {
        if (_dataCb)
            _dataCb(data, length);
    }
    void emitConnection(bool connected) const {
        if (_connCb)
            _connCb(connected);
    }

    DataCallback _dataCb = nullptr;
    ConnectionCallback _connCb = nullptr;
};

#endif // NANOPBCOMM_TRANSPORT_H
