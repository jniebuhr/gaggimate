# UART transport

Controller <-> display link. Runs the framed protocol over a serial line; same
`Endpoint` and `GaggiMateClient`/`GaggiMateServer` API on top. One class for
both ends — UART doesn't have BLE's server/client split.

## Frame format

```
COBS( channel || datagram || crc16 ) || 0x00
```

COBS keeps the body zero-free so the `0x00` marks the end of a frame; if a frame
gets garbled the receiver skips to the next `0x00` and keeps going. The CRC-16 is
there because a plain UART has no error checking — without it a flipped bit could
look like a valid boiler/pump command. Bad CRC, oversized, or malformed frames
are dropped (this also swallows the ROM bootloader's boot log if it lands on the
line).

The channel byte multiplexes the wire:

| channel | carries                                        |
|---------|------------------------------------------------|
| 0       | nanopb `Frame`s for the `Endpoint` (≤ 256 B)   |
| 1       | controller firmware update (`UartOta.h`)       |

A keepalive has no channel byte, see below.

## Usage

The facades own the port. UART is an optional second link next to BLE; enable it
before `init()` and pass the pins:

```cpp
// display (pins come from the board driver, see Driver::getUARTConf)
comms.enableUart(rxPin, txPin);               // Serial1 @ gm_uart::DEFAULT_BAUD
comms.init("GPBLC");
// controller (ext4 = RX, ext5 = TX)
comms.enableUart(rxPin, txPin);
comms.init("GPBLS", hardware, version, capabilities);
```

Each facade runs one pump task that calls `transport.loop()` and
`endpoint.loop()`. `HardwareSerial::onReceive` wakes it as soon as bytes arrive;
otherwise it ticks every 10–15 ms, which paces keepalives and retransmits.

## Link selection

Both ends offer BLE and UART at the same time. `LinkSelector` sits between the
transports and the `Endpoint` and treats UART as the preferred link: it keeps
handshaking while BLE carries the session and takes the session over as soon as
it is up; BLE is then disconnected and stops scanning / advertising until the
wire drops. The display also gives the wire a short head start before it opens a
BLE connection, so a wired board normally never touches BLE.

## Connection / keepalives

`loop()` sends a keepalive every `KEEPALIVE_INTERVAL_MS` (250 ms) no matter what,
so two idle ends find each other without either one waiting on the other. A
keepalive is one flag byte with no channel: bit 0 says "I currently receive
valid frames from you".

`isConnected()` is true once both directions are confirmed: a valid frame has
arrived in the last `LINK_TIMEOUT_MS` (1 s) and the peer's keepalive (or a data
frame) shows it hears us. A wire that only works one way therefore never counts
as a link, which keeps the BLE fallback available.

`disconnect()` has nothing to tear down, so it mutes the transport (no
keepalives, RX ignored) for twice the link timeout. The peer sees the link drop
and runs its normal reconnect path. The controller's ping watchdog uses this.

## Controller firmware update

`UartOtaSender` (display) and `UartOtaReceiver` (controller) implement a
stop-and-wait transfer on channel 1; the wire format is documented in
`UartOta.h`. `UartOtaSender` is the UART implementation of `OtaSender`; the BLE
pair is `ble/BleOtaSender` / `ble/BleOtaReceiver` (protocol in `ble/BleOta.h`),
and `ControllerOTA` drives whichever sender belongs to the active link.

- The display downloads the image to LittleFS, computes its MD5, then sends
  `BEGIN(size, md5)`, 1 KB `DATA(offset, bytes)` chunks and `END`.
- Every request gets a response carrying the next offset the controller
  expects, so a lost request or a lost response is fixed by retransmitting;
  a repeated chunk is ACKed without being written twice.
- The controller writes straight into the next OTA partition with `Update`
  (no staging file). `END` checks the MD5 and the image, switches the boot
  partition and reboots ~1.5 s later. A failed or abandoned transfer (30 s of
  silence) is aborted and the running firmware is untouched.
- Flash work runs on its own task, so keepalives and protocol frames keep
  flowing during sector erases and the final verification.
- While an update runs the controller switches heater, pump and valves off and
  ignores control commands.

## Notes

- `send()`/`sendOn()` are fine from multiple tasks; writes are mutex-guarded so
  frames don't interleave. `loop()` is single-reader, call it from one task.
- Frames are at most `MAX_DATAGRAM` (1040) bytes of payload; at 460800 baud a
  full OTA chunk is ~22 ms on the wire.
