# Beanconqueror Integration Design

**Date:** 2026-05-17  
**Status:** Approved  

## Overview

GaggiMate integrates with the Beanconqueror app by advertising as a BLE peripheral named `GaggiMate`. Beanconqueror connects to it twice — once as a scale (for weight/flow) and once as a pressure sensor — using two new device classes contributed upstream to Beanconqueror.

## Data Protocol

A single combined GATT characteristic (NOTIFY, 28 bytes, little-endian) carries all shot data:

| Offset | Type   | Field            | Source                        |
|--------|--------|------------------|-------------------------------|
| 0      | uint32 | timestamp_ms     | `millis()`                    |
| 4      | float  | weight_g         | `BLEScales` (BLEScalePlugin)  |
| 8      | float  | pressure_bar     | `controller->getState()`      |
| 12     | float  | temperature_c    | `controller->getState()`      |
| 16     | float  | pump_flow_ml_s   | `controller->getState()`      |
| 20     | float  | puck_flow_ml_s   | `controller->getState()`      |
| 24     | uint8  | flags            | bit 0 = scale connected, bit 1 = brewing |
| 25–27  | —      | reserved         | zero-filled                   |

Notification rate: 10 Hz during active brew, 1 Hz when idle.

## BLE Identity

- **Advertised name:** `GaggiMate`
- **Service UUID:** `4FAFC201-1FB5-459E-8FCC-C5C9C331914B`
- **Shot data characteristic UUID:** `BEB5483E-36E1-4688-B7F5-EA07361B26A8` (NOTIFY | READ)

## Firmware: BeanconquerorPlugin

**Files:** `src/display/plugins/BeanconquerorPlugin.h` and `BeanconquerorPlugin.cpp`

Follows the same `Plugin` interface as `MQTTPlugin` and `BLEScalePlugin`.

### setup()
- Creates a NimBLE GATT server on the shared `NimBLEDevice` instance (already initialized by `Controller::setupBluetooth()`).
- Registers the service and shot-data characteristic.
- Starts advertising `GaggiMate` with the service UUID included in advertisement data.
- Registers for `controller:brew:start` and `controller:brew:stop` events to control notification rate.

### loop()
- Reads current state from `controller->getState()` and `BLEScales` global.
- Builds the 28-byte payload and calls `characteristic->notify()`.
- Rate-limited: 100 ms intervals during brew, 1000 ms when idle.
- Skips notify if no Beanconqueror client is subscribed (checks `characteristic->getSubscribedCount()`).

### BLE multi-role
NimBLE-Arduino v1.4 supports simultaneous Central + Peripheral on ESP32. `NimBLEDevice::init()` is called once in `Controller::setupBluetooth()` and shared. The plugin adds a server role on top of the existing client connections.

While `BLEScalePlugin` actively scans for a scale, advertising pauses briefly (handled by NimBLE's radio scheduler). Once the scale is connected, advertising runs continuously.

### Registration
- Added to `Controller.cpp` alongside other plugins.
- Controlled by a `beanconquerorEnabled` boolean in `Settings`.

## Beanconqueror PR

**Repository:** `graphefruit/Beanconqueror`

### New files

**`src/classes/devices/gaggiMateScale.ts`**
- Extends `BluetoothScale`
- `DEVICE_NAME = 'GaggiMate'`
- `DATA_SERVICE` = service UUID above
- `DATA_CHARACTERISTIC` = shot data characteristic UUID above
- On notify: parse bytes 4–7 as little-endian `float32` → `setWeight(value)`
- `supportsTaring = false` (tare is handled by the physical scale, not GaggiMate)

**`src/classes/devices/gaggiMatePressure.ts`**
- Extends `PressureDevice`
- Same `DEVICE_NAME`, service UUID, and characteristic UUID
- On notify: parse bytes 8–11 as little-endian `float32` → `setPressure(value, rawData, parsedData)`
- Stores bytes 12–15 (`temperature_c`) as a readable public property for display

### Changes to `src/classes/devices/index.ts`
- Add `ScaleType.GAGGIMATE = 'GAGGIMATE'`
- Add `PressureType.GAGGIMATE = 'GAGGIMATE'`
- Add `GaggiMateScale` to `makeDevice()` switch
- Add `GaggiMatePressure` to `makePressureDevice()` switch
- Import/export both new classes

### User experience
In Beanconqueror, the user:
1. Settings → Scale → Scan → selects `GaggiMate`
2. Settings → Pressure → Scan → selects `GaggiMate`

Both connect to the same ESP32 peripheral and subscribe to the same characteristic. Each independently parses only its relevant fields from the payload.

## Out of Scope

- Flow data is present in the payload but not consumed by either Beanconqueror device class in this initial PR. A follow-up PR can add a flow device type or expose it via the scale's `flowChange` event.
- Tare commands from Beanconqueror to GaggiMate are not supported.
- Profile/shot control from Beanconqueror is not supported.
