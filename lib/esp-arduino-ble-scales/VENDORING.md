# Vendored: esp-arduino-ble-scales

This is a local copy of [gaggimate/esp-arduino-ble-scales](https://github.com/gaggimate/esp-arduino-ble-scales)
at commit `d34e692` (Apr 2026), vendored to allow atomic review of Bookoo-driver
enhancements alongside the firmware consumers that use them.

## Why vendored?

This PR makes changes to the Bookoo driver (new field parsing, improved commands)
that are meaningful only when paired with matching firmware-side consumers
(`BLEScalePlugin`, `ShotHistoryPlugin`, `Controller`, shot-log format). Shipping
the driver changes as a separate PR to the library repo + a dependent PR here
would be possible but awkward to review — reviewers would have to context-switch
between two repos to judge correctness.

## Unvendoring later

Once the maintainer agrees on the driver changes, they can be re-upstreamed:

1. Cherry-pick the commits under `src/remote_scales.{h,cpp}` and
   `src/scales/bookoo.{h,cpp}` to a fresh branch off `gaggimate/esp-arduino-ble-scales`.
2. Open a PR there.
3. Once merged, delete this `lib/esp-arduino-ble-scales/` tree here and
   restore the `https://github.com/gaggimate/esp-arduino-ble-scales` entry in
   the firmware's `platformio.ini`.

## Scope of local changes

See the commit history for `src/remote_scales.{h,cpp}` and `src/scales/bookoo.{h,cpp}`.
Every other scale driver (Acaia, Decent, Felicita, etc.) is bit-for-bit identical
to the upstream library.
