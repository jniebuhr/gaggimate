# BluetoothDevices

Drivers for Bluetooth LE coffee devices behind one interface. It started as the
[esp-arduino-ble-scales](https://github.com/gaggimate/esp-arduino-ble-scales) library (MIT, see `LICENSE`) and now
lives in the GaggiMate repository, generalised from scales to typed devices.

## Concepts

| Type | Role |
|---|---|
| `BluetoothDevice` | What every device has: name, address, RSSI, connect/disconnect/update, optional battery level and power-off. |
| `BluetoothScale` | Sub-interface for scales: weight callback, tare, optional flow rate, stopwatch and weight unit. |
| `BluetoothGrinder` | Sub-interface for grinders: `applySettings()` (grind size, rpm, feed rpm), reported settings and state. |
| `BluetoothDeviceRegistry` | Maps an advertised device to the driver that implements its protocol. |
| `BluetoothDeviceScanner` | Continuous scan that collects every device a registered driver claims, tagged with its type. |

`device->getType()` tells the kinds apart; `asScale()` / `asGrinder()` return the typed view (or `nullptr`) without
RTTI. `BluetoothDevices::registerBuiltinDrivers()` registers everything listed below.

The firmware side is `src/display/plugins/BluetoothDevicesPlugin`: it keeps at most one connected device per type,
remembers the paired device of each type and reconnects it when it shows up in the scan.

## Supported devices

Scales: Acaia (Lunar, Pearl, Pearl S, Pyxis, Umbra), Bookoo Themis (Mini, Ultra), Decent Scale, EspressiScale,
DiFluid Microbalance, Eclair, Eureka Precisa, Felicita, Timemore Black Mirror, Timemore Dot / Basic 3.0 Link,
Varia AKU, WeighMyBru, MyScale.

Grinders: Bookoo Motto 80 (`grinders/bookoo_motto.*`, grinder firmware v1.2.19.0820 or newer). Protocol reference:
<https://github.com/BooKooCode/OpenSource/tree/main/bookoo_motto80>. The grinder exposes no start/stop command, and its
burr gap is manual: the grind size only sets the value shown in the grinder's settings.

## Adding a device

1. Derive from `BluetoothScale` or `BluetoothGrinder` and implement the protocol. For a new *kind* of device add a
   `BluetoothDeviceType`, a sub-interface next to the existing two and an `asX()` view.
2. Add a registration helper with a `handles()` matcher (usually on the advertised name) that calls
   `BluetoothDeviceRegistry::getInstance()->registerDriver<YourDevice>("plugin-id", &handles)`; the device type comes
   from `YourDevice::TYPE`.
3. Call it from `BluetoothDevices::registerBuiltinDrivers()` and add the model name to the web UI
   (`web/src/utils/scaleModels.js` or `bluetoothDevices.js`).

Notifications arrive on the NimBLE host task. Keep protocol logic that needs no radio in its own file, like
`grinders/bookoo_motto_protocol.*`, so it can be unit-tested on the host (`pio test -e native -f test_bookoo_motto`).
