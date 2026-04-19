# Vendored: esp-arduino-ble-scales

This is a local copy of [gaggimate/esp-arduino-ble-scales](https://github.com/gaggimate/esp-arduino-ble-scales)
at commit [`46bae8c7`](https://github.com/gaggimate/esp-arduino-ble-scales/commit/46bae8c7) (2026-03-18, "Add RSSI property to DiscoveredDevice and RemoteScales"),
vendored to allow atomic review of Bookoo-driver enhancements alongside the
firmware consumers that use them.

## Upstream PR

The driver changes in this vendored copy are now open as an upstream PR:
[gaggimate/esp-arduino-ble-scales#29](https://github.com/gaggimate/esp-arduino-ble-scales/pull/29)
— "fix(bookoo): full protocol parsing + framing/correctness fixes".

The vendored copy will be removed and `platformio.ini` restored to use the
upstream library once that PR merges.

## Why vendored (originally)?

This PR makes changes to the Bookoo driver (new field parsing, improved commands,
correctness fixes) that are meaningful only when paired with matching firmware-side
consumers (`BLEScalePlugin`, `ShotHistoryPlugin`, `Controller`, shot-log format).
Shipping the driver changes as a separate PR to the library repo + a dependent PR
here would have made the initial review awkward — reviewers would have had to
context-switch between two repos to judge correctness.

Now that the design is validated, the driver changes are upstreamed (see above);
vendoring is temporary.

## Scope of local changes

See the commit history for `src/remote_scales.h` and `src/scales/bookoo.{h,cpp}`.
Every other scale driver (Acaia, Decent, Felicita, Timemore, Varia, WeighMyBrew,
MyScale, Difluid, Eclair, Eureka) is bit-for-bit identical to the upstream library.

## Removing this vendoring (after upstream merges)

1. Delete this `lib/esp-arduino-ble-scales/` tree.
2. Restore the `https://github.com/gaggimate/esp-arduino-ble-scales` entry in
   the firmware's `platformio.ini` `lib_deps_default` (pin to the merge commit
   or a tag).
3. Rebuild + reflash to confirm parity.
