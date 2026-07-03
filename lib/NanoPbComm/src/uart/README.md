# UART transport

Runs the framed protocol over a serial link instead of BLE. Same `Endpoint` and
`GaggiMateClient`/`GaggiMateServer` API on top. One class for both ends — UART
doesn't have BLE's server/client split.

## Frame format

```
COBS( datagram || crc16 ) || 0x00
```

COBS keeps the body zero-free so the `0x00` marks the end of a frame; if a frame
gets garbled the receiver skips to the next `0x00` and keeps going. The CRC-16 is
there because a plain UART has no error checking — without it a flipped bit could
look like a valid boiler/pump command. Bad CRC, oversized, or malformed frames
are dropped.

## Usage

You set up the port, then hand the `Stream` over:

```cpp
#include "uart/UartTransport.h"

UartTransport transport(Serial1);
Endpoint endpoint(transport);

void setup() {
    Serial1.begin(460800, SERIAL_8N1, RX_PIN, TX_PIN);
    endpoint.begin();
    transport.begin();
}
```

No RX interrupt like NimBLE, so you have to pump it. Call `transport.loop()`
wherever you call `endpoint.loop()`:

```cpp
void loop() {
    transport.loop();
    endpoint.loop();
}
```

## Connection / keepalives

`isConnected()` is true while a valid frame has arrived in the last
`LINK_TIMEOUT_MS` (1 s) — the wire is always there, so this tracks whether the
other side is actually talking.

`loop()` sends a keepalive every `KEEPALIVE_INTERVAL_MS` (250 ms) no matter what.
This is on purpose: the `Endpoint` only sends while connected, so if both ends
sat waiting to hear something first, nothing would ever go out. The keepalive is
an empty datagram, which the `Endpoint` never sends itself, so the transport
spots it, uses it for liveness, and drops it.

Both constants are at the top of `UartTransport.h`.

## Notes

- `send()` is fine from multiple tasks; writes are mutex-guarded so frames don't
  interleave. `loop()` is single-reader, call it from one task.
- Datagrams are ~260 bytes max after framing — pick a baud rate with headroom.
- Nothing uses this yet. To put a facade on UART: swap its transport member for a
  `UartTransport`, give it a configured port, and add `transport.loop()` to the
  pump task.
