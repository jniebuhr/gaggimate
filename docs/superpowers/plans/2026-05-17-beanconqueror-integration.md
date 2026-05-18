# Beanconqueror Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GaggiMate's display ESP32 advertise as a BLE peripheral (`GaggiMate`) exposing pressure, temperature, flow, and relayed scale weight so the Beanconqueror mobile app can connect to it for live shot tracking.

**Architecture:** A new `BeanconquerorPlugin` adds a GATT server role to the display ESP32 alongside its existing Central role, using the shared NimBLE-Arduino stack. It notifies a single 28-byte combined characteristic at 10 Hz during brews. A companion Beanconqueror PR adds two small TypeScript device classes (`GaggiMateScale` and `GaggiMatePressure`) that subscribe to the same characteristic and parse their respective fields.

**Tech Stack:** NimBLE-Arduino 1.4 (ESP32 firmware), TypeScript (Beanconqueror PR)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/display/plugins/BeanconquerorPlugin.h` | Create | Plugin class declaration + UUIDs |
| `src/display/plugins/BeanconquerorPlugin.cpp` | Create | GATT server setup, payload build, notify loop |
| `src/display/plugins/BLEScalePlugin.h` | Modify | Add `getLastWeight()` public method |
| `src/display/plugins/BLEScalePlugin.cpp` | Modify | Cache weight value in `onMeasurement()` |
| `src/display/core/Controller.cpp` | Modify | Include + register `BeanconquerorPlugin` |
| *(Beanconqueror repo)* `src/classes/devices/gaggiMateScale.ts` | Create | BluetoothScale subclass for weight |
| *(Beanconqueror repo)* `src/classes/devices/gaggiMatePressure.ts` | Create | PressureDevice subclass for pressure |
| *(Beanconqueror repo)* `src/classes/devices/index.ts` | Modify | Add enum values + factory cases + exports |

---

## Task 1: Expose last weight from BLEScalePlugin

**Files:**
- Modify: `src/display/plugins/BLEScalePlugin.h`
- Modify: `src/display/plugins/BLEScalePlugin.cpp`

- [ ] **Step 1: Add `lastWeight` member and `getLastWeight()` to the header**

Open `src/display/plugins/BLEScalePlugin.h`. Add one line to the `private:` section and one to `public:`:

```cpp
// In the public: section, after getUUID():
float getLastWeight() const { return lastWeight; }

// In the private: section, after lastMeasurementTime:
float lastWeight = 0.0f;
```

- [ ] **Step 2: Cache the weight in `onMeasurement`**

Open `src/display/plugins/BLEScalePlugin.cpp`. Find the `BLEScalePlugin::onMeasurement` method. Add one line to cache the value at the top of the function body (before any existing logic):

```cpp
void BLEScalePlugin::onMeasurement(float value) const {
    lastWeight = value;          // <-- add this line
    // ... existing code follows
```

Note: `lastWeight` must be declared `mutable` in the header because `onMeasurement` is `const`. Update the declaration in `BLEScalePlugin.h` to:

```cpp
mutable float lastWeight = 0.0f;
```

- [ ] **Step 3: Build to verify no errors**

```bash
cd C:\Users\hernajic\Documents\Projects\gaggimate
pio run -e display 2>&1 | tail -5
```

Expected: `SUCCESS` or only pre-existing warnings.

- [ ] **Step 4: Commit**

```bash
git add src/display/plugins/BLEScalePlugin.h src/display/plugins/BLEScalePlugin.cpp
git commit -m "feat: expose last scale weight from BLEScalePlugin"
```

---

## Task 2: Create BeanconquerorPlugin header

**Files:**
- Create: `src/display/plugins/BeanconquerorPlugin.h`

- [ ] **Step 1: Create the header file**

```cpp
#ifndef BEANCONQUERORPLUGIN_H
#define BEANCONQUERORPLUGIN_H

#include "../core/Plugin.h"
#include <NimBLEDevice.h>

#define BC_SERVICE_UUID        "4FAFC201-1FB5-459E-8FCC-C5C9C331914B"
#define BC_SHOT_DATA_CHAR_UUID "BEB5483E-36E1-4688-B7F5-EA07361B26A8"

constexpr unsigned long BC_NOTIFY_INTERVAL_BREW_MS = 100;   // 10 Hz
constexpr unsigned long BC_NOTIFY_INTERVAL_IDLE_MS = 1000;  // 1 Hz

class BeanconquerorPlugin : public Plugin {
  public:
    BeanconquerorPlugin();
    ~BeanconquerorPlugin() override = default;

    void setup(Controller *controller, PluginManager *pluginManager) override;
    void loop() override;

  private:
    void initBLEServer();
    void buildAndNotify();

    Controller *controller = nullptr;
    PluginManager *pluginManager = nullptr;

    NimBLEServer *server = nullptr;
    NimBLECharacteristic *shotDataChar = nullptr;

    bool bleReady = false;
    bool brewing = false;
    unsigned long lastNotify = 0;
};

#endif // BEANCONQUERORPLUGIN_H
```

- [ ] **Step 2: Commit**

```bash
git add src/display/plugins/BeanconquerorPlugin.h
git commit -m "feat: add BeanconquerorPlugin header"
```

---

## Task 3: Implement BeanconquerorPlugin

**Files:**
- Create: `src/display/plugins/BeanconquerorPlugin.cpp`

- [ ] **Step 1: Create the implementation file**

```cpp
#include "BeanconquerorPlugin.h"
#include "BLEScalePlugin.h"
#include "../core/Controller.h"
#include "../core/PluginManager.h"
#include <NimBLEDevice.h>
#include <cstring>

BeanconquerorPlugin::BeanconquerorPlugin() = default;

void BeanconquerorPlugin::setup(Controller *ctrl, PluginManager *manager) {
    controller = ctrl;
    pluginManager = manager;

    manager->on("controller:bluetooth:init", [this](Event const &) {
        initBLEServer();
    });

    manager->on("controller:brew:start", [this](Event const &) { brewing = true; });
    manager->on("controller:brew:prestart", [this](Event const &) { brewing = true; });
    manager->on("controller:brew:stop", [this](Event const &) { brewing = false; });
    manager->on("controller:mode:change", [this](Event const &event) {
        // If mode returns to standby, treat as not brewing
        if (event.getInt("mode") == 0) brewing = false;
    });
}

void BeanconquerorPlugin::initBLEServer() {
    // NimBLEDevice::init() was already called by NimBLEClientController.
    // Calling it again with "GaggiMate" updates the device name only.
    NimBLEDevice::init("GaggiMate");

    server = NimBLEDevice::createServer();

    NimBLEService *pService = server->createService(BC_SERVICE_UUID);

    shotDataChar = pService->createCharacteristic(
        BC_SHOT_DATA_CHAR_UUID,
        NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ
    );

    pService->start();

    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BC_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->start();

    bleReady = true;
    ESP_LOGI("BeanconquerorPlugin", "BLE peripheral ready, advertising as GaggiMate");
}

void BeanconquerorPlugin::loop() {
    if (!bleReady || shotDataChar == nullptr) return;
    if (shotDataChar->getSubscribedCount() == 0) return;

    const unsigned long interval = brewing ? BC_NOTIFY_INTERVAL_BREW_MS
                                           : BC_NOTIFY_INTERVAL_IDLE_MS;
    const unsigned long now = millis();
    if (now - lastNotify < interval) return;
    lastNotify = now;

    buildAndNotify();
}

void BeanconquerorPlugin::buildAndNotify() {
    // 28-byte payload (little-endian):
    //  [0]  uint32 timestamp_ms
    //  [4]  float  weight_g
    //  [8]  float  pressure_bar
    //  [12] float  temperature_c
    //  [16] float  pump_flow_ml_s
    //  [20] float  puck_flow_ml_s
    //  [24] uint8  flags (bit 0 = scale connected, bit 1 = brewing)
    //  [25-27] reserved

    uint8_t payload[28] = {};

    const uint32_t ts = static_cast<uint32_t>(millis());
    memcpy(payload + 0, &ts, 4);

    const float weight = BLEScales.getLastWeight();
    memcpy(payload + 4, &weight, 4);

    const float pressure = controller->getCurrentPressure();
    memcpy(payload + 8, &pressure, 4);

    const float temperature = controller->getCurrentTemp();
    memcpy(payload + 12, &temperature, 4);

    const float pumpFlow = controller->getCurrentPumpFlow();
    memcpy(payload + 16, &pumpFlow, 4);

    const float puckFlow = controller->getCurrentPuckFlow();
    memcpy(payload + 20, &puckFlow, 4);

    uint8_t flags = 0;
    if (BLEScales.isConnected()) flags |= 0x01;
    if (brewing)                  flags |= 0x02;
    payload[24] = flags;

    shotDataChar->setValue(payload, sizeof(payload));
    shotDataChar->notify();
}
```

- [ ] **Step 2: Build to verify**

```bash
pio run -e display 2>&1 | tail -5
```

Expected: `SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add src/display/plugins/BeanconquerorPlugin.cpp
git commit -m "feat: implement BeanconquerorPlugin GATT server"
```

---

## Task 4: Register plugin in Controller

**Files:**
- Modify: `src/display/core/Controller.cpp`

- [ ] **Step 1: Add include**

In `src/display/core/Controller.cpp`, add this line alongside the other plugin includes (after the existing `#include <display/plugins/BLEScalePlugin.h>` line):

```cpp
#include <display/plugins/BeanconquerorPlugin.h>
```

- [ ] **Step 2: Register the plugin**

In `Controller::setup()`, add one line after the `pluginManager->registerPlugin(&BLEScales);` call (line 83):

```cpp
pluginManager->registerPlugin(new BeanconquerorPlugin());
```

- [ ] **Step 3: Build to verify**

```bash
pio run -e display 2>&1 | tail -5
```

Expected: `SUCCESS`.

- [ ] **Step 4: Commit**

```bash
git add src/display/core/Controller.cpp
git commit -m "feat: register BeanconquerorPlugin in Controller"
```

---

## Task 5: Beanconqueror PR — GaggiMateScale TypeScript class

> **Note:** Tasks 5–7 are changes to the **Beanconqueror repository** (`graphefruit/Beanconqueror`), not this repo. Fork it, create a branch `feature/gaggimate-device`, and make these changes there.

**Files (Beanconqueror repo):**
- Create: `src/classes/devices/gaggiMateScale.ts`

- [ ] **Step 1: Create the scale device class**

```typescript
import { PeripheralData } from './ble.types';
import { BluetoothScale, SCALE_TIMER_COMMAND, Weight } from './bluetoothDevice';
import { Logger } from './common/logger';
import { ScaleType } from './index';

declare var ble: any;

export class GaggiMateScale extends BluetoothScale {
  public static DEVICE_NAME = 'GaggiMate';
  public static DATA_SERVICE = '4FAFC201-1FB5-459E-8FCC-C5C9C331914B';
  public static DATA_CHARACTERISTIC = 'BEB5483E-36E1-4688-B7F5-EA07361B26A8';

  public override batteryLevel: number;
  protected override weight: Weight = {
    actual: 0,
    old: 0,
    smoothed: 0,
    oldSmoothed: 0,
    notMutatedWeight: 0,
  };
  private logger: Logger;

  constructor(data: PeripheralData, type: ScaleType) {
    super(data, type);
    this.logger = new Logger('GaggiMateScale');
    this.supportsTaring = false;
    this.connect();
  }

  public static test(device: any): boolean {
    try {
      if (device?.name?.toLowerCase().includes(GaggiMateScale.DEVICE_NAME.toLowerCase())) {
        return true;
      }
      if (
        device?.advertising?.kCBAdvDataLocalName
          ?.toLowerCase()
          .includes(GaggiMateScale.DEVICE_NAME.toLowerCase())
      ) {
        return true;
      }
    } catch (ex) {}
    return false;
  }

  public override getWeight() {
    return this.weight.actual;
  }

  public override getSmoothedWeight() {
    return this.weight.smoothed;
  }

  public override getOldSmoothedWeight() {
    return this.weight.old;
  }

  public override async setTimer(_command: SCALE_TIMER_COMMAND) {
    // GaggiMate does not support remote timer control
  }

  public override async connect() {
    this.logger.log('Connecting...');
    await this.attachNotification();
  }

  public override async tare() {
    // Tare is handled on the physical scale connected to GaggiMate
  }

  public override disconnectTriggered(): void {
    this.logger.log('Disconnecting...');
    this.deattachNotification();
  }

  private async attachNotification() {
    ble.startNotification(
      this.device_id,
      GaggiMateScale.DATA_SERVICE,
      GaggiMateScale.DATA_CHARACTERISTIC,
      async (_data: any) => {
        this.parsePayload(_data);
      },
      (_data: any) => {},
    );
  }

  // Payload layout (little-endian):
  //  [0]  uint32 timestamp_ms
  //  [4]  float  weight_g         ← parsed here
  //  [8]  float  pressure_bar
  //  [12] float  temperature_c
  //  [16] float  pump_flow_ml_s
  //  [20] float  puck_flow_ml_s
  //  [24] uint8  flags
  private parsePayload(data: any): void {
    if (data.byteLength < 8) return;
    const view = new DataView(data);
    const weightG = view.getFloat32(4, true); // little-endian
    this.setWeight(weightG);
  }

  private deattachNotification() {
    ble.stopNotification(
      this.device_id,
      GaggiMateScale.DATA_SERVICE,
      GaggiMateScale.DATA_CHARACTERISTIC,
      (_e: any) => {},
      (_e: any) => {},
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/classes/devices/gaggiMateScale.ts
git commit -m "feat: add GaggiMateScale BLE device class"
```

---

## Task 6: Beanconqueror PR — GaggiMatePressure TypeScript class

**Files (Beanconqueror repo):**
- Create: `src/classes/devices/gaggiMatePressure.ts`

- [ ] **Step 1: Create the pressure device class**

```typescript
import { PeripheralData } from './ble.types';
import { Logger } from './common/logger';
import { PressureDevice } from './pressureBluetoothDevice';

declare var ble: any;

export class GaggiMatePressure extends PressureDevice {
  public static DEVICE_NAME = 'GaggiMate';
  public static DATA_SERVICE = '4FAFC201-1FB5-459E-8FCC-C5C9C331914B';
  public static DATA_CHARACTERISTIC = 'BEB5483E-36E1-4688-B7F5-EA07361B26A8';

  public temperatureC: number = 0;

  private logger: Logger;

  constructor(data: PeripheralData) {
    super(data);
    this.logger = new Logger('GaggiMatePressure');
    this.connect();
  }

  public static test(device: any): boolean {
    try {
      if (device?.name?.toLowerCase().includes(GaggiMatePressure.DEVICE_NAME.toLowerCase())) {
        return true;
      }
    } catch (ex) {}
    return false;
  }

  public connect(): void {
    this.attachNotification();
  }

  public disconnect(): void {
    this.deattachNotification();
  }

  public async updateZero(): Promise<void> {
    // GaggiMate calibrates pressure on the controller board, not via BLE
  }

  public enableValueTransmission(): void {
    // always transmitting
  }

  public disableValueTransmission(): Promise<void> {
    return Promise.resolve();
  }

  // Payload layout (little-endian):
  //  [0]  uint32 timestamp_ms
  //  [4]  float  weight_g
  //  [8]  float  pressure_bar     ← parsed here
  //  [12] float  temperature_c    ← parsed here (stored in this.temperatureC)
  //  [16] float  pump_flow_ml_s
  //  [20] float  puck_flow_ml_s
  //  [24] uint8  flags
  private parsePayload(data: any): void {
    if (data.byteLength < 16) return;
    const view = new DataView(data);
    const pressureBar = view.getFloat32(8, true);  // little-endian
    this.temperatureC = view.getFloat32(12, true); // little-endian
    this.setPressure(pressureBar, data, new Float32Array([pressureBar]));
  }

  private attachNotification() {
    ble.startNotification(
      this.device_id,
      GaggiMatePressure.DATA_SERVICE,
      GaggiMatePressure.DATA_CHARACTERISTIC,
      async (_data: any) => {
        this.parsePayload(_data);
      },
      (_data: any) => {},
    );
  }

  private deattachNotification() {
    ble.stopNotification(
      this.device_id,
      GaggiMatePressure.DATA_SERVICE,
      GaggiMatePressure.DATA_CHARACTERISTIC,
      (_e: any) => {},
      (_e: any) => {},
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/classes/devices/gaggiMatePressure.ts
git commit -m "feat: add GaggiMatePressure BLE device class"
```

---

## Task 7: Beanconqueror PR — Wire up in index.ts

**Files (Beanconqueror repo):**
- Modify: `src/classes/devices/index.ts`

- [ ] **Step 1: Add imports at the top of the file**

Add these two imports alongside the existing device imports:

```typescript
import { GaggiMateScale } from './gaggiMateScale';
import { GaggiMatePressure } from './gaggiMatePressure';
```

- [ ] **Step 2: Add `GAGGIMATE` to ScaleType enum**

In the `export enum ScaleType` block, add:

```typescript
GAGGIMATE = 'GAGGIMATE',
```

- [ ] **Step 3: Add `GAGGIMATE` to PressureType enum**

In the `export enum PressureType` block, add:

```typescript
GAGGIMATE = 'GAGGIMATE',
```

- [ ] **Step 4: Add GaggiMateScale case to `makeDevice()`**

In the `makeDevice()` function's switch statement, add:

```typescript
case ScaleType.GAGGIMATE:
  return new GaggiMateScale(data, type);
```

- [ ] **Step 5: Add GaggiMatePressure case to `makePressureDevice()`**

In the `makePressureDevice()` function's switch statement, add:

```typescript
case PressureType.GAGGIMATE:
  return new GaggiMatePressure(data);
```

- [ ] **Step 6: Build to verify TypeScript compiles**

```bash
cd <beanconqueror-repo>
npm install
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/classes/devices/index.ts
git commit -m "feat: register GaggiMate as scale and pressure device"
```

---

## Task 8: Build verification

**Files:** firmware only

- [ ] **Step 1: Full display build**

```bash
cd C:\Users\hernajic\Documents\Projects\gaggimate
pio run -e display 2>&1 | tail -10
```

Expected: `SUCCESS`.

- [ ] **Step 2: Headless variant builds**

```bash
pio run -e display-headless-8m 2>&1 | tail -5
pio run -e display-headless-4m 2>&1 | tail -5
```

Expected: `SUCCESS` for both.

- [ ] **Step 3: Commit if any minor fixes were needed**

```bash
git add -p
git commit -m "fix: address build issues in BeanconquerorPlugin"
```

---

## Self-Review Notes

- **Spec coverage:** All spec requirements covered — payload format matches spec exactly (28 bytes, all 6 fields + flags), advertising name `GaggiMate`, service + characteristic UUIDs match spec, 10 Hz brew / 1 Hz idle notification rates, both Beanconqueror device classes implemented.
- **No placeholders:** All code is complete.
- **Type consistency:** `getLastWeight()` defined in Task 1, called in Task 3. `getCurrentPressure()`, `getCurrentTemp()`, `getCurrentPuckFlow()`, `getCurrentPumpFlow()` are existing Controller methods confirmed in codebase. `BLEScales.isConnected()` is existing public method on BLEScalePlugin.
- **Payload byte offsets** are consistent across firmware (Task 3) and both TypeScript classes (Tasks 5–6): weight at offset 4, pressure at 8, temperature at 12.
