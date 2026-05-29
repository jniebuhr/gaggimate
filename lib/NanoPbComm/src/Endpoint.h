#ifndef NANOPBCOMM_ENDPOINT_H
#define NANOPBCOMM_ENDPOINT_H

#include "CoalescingPriorityQueue.h"
#include "Messages.h"
#include "Protocol.h"
#include "Transport.h"
#include <array>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <functional>

/**
 * Transport-agnostic protocol session.
 *
 * Owns the outbound coalescing queue and implements reliable delivery on top of
 * a datagram Transport:
 *
 *   - send() enqueues a Payload; the send pump drains the highest-priority
 *     entries into one Frame, stamps a monotonic id, and transmits it.
 *   - A frame stays "in flight" (and is retransmitted on timeout) until the
 *     peer ACKs its id; only then is the next frame sent. This is what keeps a
 *     message effectively in the queue until acknowledged.
 *   - Incoming frames are de-duplicated by id (so retransmits are safe even for
 *     non-idempotent ops) and ACKed; payloads are dispatched by oneof tag to
 *     typed handlers -- no run-time type erasure.
 *
 * Threading: decode + ACK/dedup + the send pump run on the transport's callback
 * thread, but registered handlers are invoked on a dedicated dispatch task (fed
 * by an inbound payload queue) so slow application callbacks never block the BLE
 * host task. If the inbound queue is full the frame is left un-ACKed, which
 * back-pressures the sender into retransmitting. Queue + in-flight state are
 * guarded by a mutex; handlers run with the mutex released, so a handler may
 * call send() re-entrantly.
 */
class Endpoint {
  public:
    using Handler = std::function<void(const gm::Payload &)>;
    using ConnectionHandler = std::function<void(bool connected)>;

    explicit Endpoint(Transport &transport);
    ~Endpoint();

    // Hook transport callbacks. Call once after the transport is constructed.
    void begin();

    // Drive the send pump + retransmit logic. Call frequently (e.g. every
    // 10-20ms from a task or the main loop).
    void loop();

    // Enqueue a payload for reliable, coalesced delivery (default priority by
    // message family).
    void send(const gm::Payload &payload);
    void send(const gm::Payload &payload, uint8_t priority);

    // Enqueue several payloads to be delivered together in a single frame
    // (atomic multi-component update). They are drained into one frame on the
    // next pump as long as nothing else preempts them.
    void sendBatch(const gm::Payload *payloads, size_t count);

    // Register a handler for a oneof tag (e.g. Payload_sensor_tag). Replaces any
    // previously registered handler for that tag.
    void on(pb_size_t which, Handler handler);

    // Invoked (with the mutex released) whenever the link connects/disconnects,
    // after internal state has been reset. Used to push connect-time messages.
    void onConnection(ConnectionHandler handler) { _connHandler = std::move(handler); }

    bool isConnected() const { return _transport.isConnected(); }

  private:
    static constexpr size_t QUEUE_CAPACITY = 16;
    static constexpr size_t MAX_KEYS = 256; // >= which_content_max * MAX_DEVICES
    static constexpr size_t BUFFER_SIZE = 256;
    static constexpr size_t MAX_PAYLOADS_PER_FRAME = 6; // matches Frame.payloads max_count
    static constexpr unsigned long ACK_TIMEOUT_MS = 150;
    static constexpr uint8_t MAX_RETRIES = 5;
    static constexpr size_t HANDLER_SLOTS = 32;  // > highest Payload_*_tag
    static constexpr size_t RX_QUEUE_DEPTH = 12; // inbound payloads awaiting dispatch
    static constexpr uint32_t DISPATCH_STACK = 6144;

    Transport &_transport;
    CoalescingPrioQueue<QUEUE_CAPACITY, uint16_t, gm::Payload, MAX_KEYS> _queue;
    std::array<Handler, HANDLER_SLOTS> _handlers{};
    SemaphoreHandle_t _mutex = nullptr;

    // In-flight frame, retained until ACKed or retries are exhausted.
    uint8_t _txBuf[BUFFER_SIZE]{};
    size_t _txLen = 0;
    uint32_t _inFlightId = 0;
    unsigned long _sentAt = 0;
    uint8_t _retries = 0;
    bool _inFlight = false;

    uint32_t _nextId = 1; // next outbound frame id (0 is reserved for ACKs)
    uint32_t _lastRxId = 0;

    ConnectionHandler _connHandler = nullptr;

    // Inbound payloads decoded on the transport thread, drained by the dispatch
    // task so handlers never run on the BLE host task.
    QueueHandle_t _rxQueue = nullptr;
    TaskHandle_t _dispatchTask = nullptr;

    gm::Frame _rxFrame{}; // decode scratch (onData is single-threaded per link)
    gm::Frame _txFrame{}; // encode scratch (guarded by _mutex in pump())

    void handleData(const uint8_t *data, size_t length);
    void handleConnection(bool connected);
    void pump();
    void sendAck(uint32_t id);
    void dispatch(const gm::Payload &payload);
    static void dispatchTaskFn(void *arg);
    static bool encodeFrame(const gm::Frame &frame, uint8_t *buf, size_t bufSize, size_t *outLen);

    void lock() {
        if (_mutex)
            xSemaphoreTakeRecursive(_mutex, portMAX_DELAY);
    }
    void unlock() {
        if (_mutex)
            xSemaphoreGiveRecursive(_mutex);
    }
};

#endif // NANOPBCOMM_ENDPOINT_H
