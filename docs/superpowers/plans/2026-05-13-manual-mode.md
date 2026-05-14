# Manual Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Manual machine mode with saved pressure/flow/temperature defaults, safe armed state, live target updates, and shot-history recording.

**Architecture:** Firmware adds `MODE_MANUAL = 5`, persists Manual defaults in `Settings`, starts a `ManualProcess` only when Start is pressed, and drives it through the existing advanced pump output path. The Web UI adds Manual to the home dashboard mode rail and replaces the recipe panel with a Manual console when selected.

**Tech Stack:** ESP32 C++ firmware with PlatformIO, Preact/Vite Web UI, `node:test` for focused Web UI logic tests.

---

## File Structure

- Modify `src/display/core/constants.h`: add Manual constants and first-version bounds.
- Modify `src/display/core/Settings.h` and `src/display/core/Settings.cpp`: persist Manual target type, pressure, flow, and temperature with clamping.
- Create `src/display/core/process/ManualProcess.h`: state-light live process for Manual output.
- Modify `src/display/core/Controller.h` and `src/display/core/Controller.cpp`: expose Manual update APIs, start ManualProcess, report Manual targets, and send advanced output.
- Modify `src/display/plugins/WebUIPlugin.cpp`: add Manual defaults to `evt:status`, accept `req:manual:update`, and reject unsupported Manual mode.
- Modify `src/display/plugins/ShotHistoryPlugin.cpp`: record Manual runs and label headers/index entries as `Manual`.
- Modify `web/src/pages/Home/dashboardLogic.js` and `web/src/pages/Home/dashboardLogic.test.js`: add Manual mode constants, labels, action state, target labels, and clamping helpers.
- Modify `web/src/services/ApiService.js`: map Manual status fields into readable keys.
- Modify `web/src/utils/homeConstants.jsx`: add Manual legacy labels for compact controls.
- Modify `web/src/pages/Home/DashboardMerged.jsx`: render the Manual console in the selected right-panel layout and wire Start/Stop/update requests.

## Task 1: Web Logic And Status Plumbing

**Files:**
- Modify: `web/src/pages/Home/dashboardLogic.js`
- Modify: `web/src/pages/Home/dashboardLogic.test.js`
- Modify: `web/src/services/ApiService.js`
- Modify: `web/src/utils/homeConstants.jsx`

- [ ] **Step 1: Write failing Web logic tests**

Add these imports to `web/src/pages/Home/dashboardLogic.test.js`:

```js
  MODE_MANUAL,
  clampManualFlow,
  clampManualPressure,
  clampManualTemperature,
  getManualControlLabels,
```

Add these tests:

```js
test('available mode options include manual before grind when grind is available', () => {
  const options = getAvailableModeOptions(true);

  assert.deepEqual(
    options.map(option => option.name),
    ['STANDBY', 'BREW', 'STEAM', 'WATER', 'MANUAL', 'GRIND'],
  );
});

test('available mode options include manual when grind is unavailable', () => {
  const options = getAvailableModeOptions(false);

  assert.deepEqual(
    options.map(option => option.name),
    ['STANDBY', 'BREW', 'STEAM', 'WATER', 'MANUAL'],
  );
});

test('manual mode process kind is manual', () => {
  assert.equal(getProcessKindForMode(MODE_MANUAL), 'manual');
});

test('manual primary action starts manual when armed', () => {
  const state = getPrimaryActionState({
    active: false,
    finished: false,
    mode: MODE_MANUAL,
  });

  assert.equal(state.label, 'START MANUAL');
  assert.equal(state.action, 'start-process');
  assert.equal(state.processKind, 'manual');
});

test('manual primary action stops manual when running', () => {
  const state = getPrimaryActionState({
    active: true,
    finished: false,
    mode: MODE_MANUAL,
  });

  assert.equal(state.label, 'STOP MANUAL');
  assert.equal(state.action, 'deactivate');
  assert.equal(state.processKind, null);
});

test('manual primary action clears manual when finished', () => {
  const state = getPrimaryActionState({
    active: false,
    finished: true,
    mode: MODE_MANUAL,
  });

  assert.equal(state.label, 'CLEAR');
  assert.equal(state.action, 'clear');
});

test('manual target labels change with target type', () => {
  assert.deepEqual(getManualControlLabels('pressure'), {
    pressure: 'PRESSURE TARGET',
    flow: 'FLOW LIMIT',
  });
  assert.deepEqual(getManualControlLabels('flow'), {
    pressure: 'PRESSURE LIMIT',
    flow: 'FLOW TARGET',
  });
});

test('manual target values are clamped to first-version bounds', () => {
  assert.equal(clampManualTemperature(70), 80);
  assert.equal(clampManualTemperature(110), 105);
  assert.equal(clampManualPressure(-1), 0);
  assert.equal(clampManualPressure(15), 12);
  assert.equal(clampManualFlow(-1), 0);
  assert.equal(clampManualFlow(7), 6);
});
```

- [ ] **Step 2: Verify tests fail for missing Manual exports**

Run:

```powershell
cd web; node --test src/pages/Home/dashboardLogic.test.js
```

Expected: fail with a module import error such as `does not provide an export named 'MODE_MANUAL'`.

- [ ] **Step 3: Implement Web logic exports**

In `web/src/pages/Home/dashboardLogic.js`, add:

```js
export const MODE_MANUAL = 5;
export const MANUAL_TARGET_PRESSURE = 'pressure';
export const MANUAL_TARGET_FLOW = 'flow';
export const MANUAL_TEMP_MIN = 80;
export const MANUAL_TEMP_MAX = 105;
export const MANUAL_PRESSURE_MIN = 0;
export const MANUAL_PRESSURE_MAX = 12;
export const MANUAL_FLOW_MIN = 0;
export const MANUAL_FLOW_MAX = 6;
```

Update `MODE_OPTIONS` so Manual appears before Grind:

```js
export const MODE_OPTIONS = [
  { id: MODE_STANDBY, name: 'STANDBY' },
  { id: MODE_BREW, name: 'BREW' },
  { id: MODE_STEAM, name: 'STEAM' },
  { id: MODE_WATER, name: 'WATER' },
  { id: MODE_MANUAL, name: 'MANUAL' },
  { id: MODE_GRIND, name: 'GRIND' },
];
```

Add helpers:

```js
function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function clampManualTemperature(value) {
  return clampNumber(value, MANUAL_TEMP_MIN, MANUAL_TEMP_MAX);
}

export function clampManualPressure(value) {
  return clampNumber(value, MANUAL_PRESSURE_MIN, MANUAL_PRESSURE_MAX);
}

export function clampManualFlow(value) {
  return clampNumber(value, MANUAL_FLOW_MIN, MANUAL_FLOW_MAX);
}

export function getManualControlLabels(targetType) {
  return targetType === MANUAL_TARGET_FLOW
    ? { pressure: 'PRESSURE LIMIT', flow: 'FLOW TARGET' }
    : { pressure: 'PRESSURE TARGET', flow: 'FLOW LIMIT' };
}
```

Update `getProcessKindForMode`:

```js
if (mode === MODE_MANUAL) return 'manual';
```

Update `getPrimaryActionState` before the generic active/finished branches:

```js
const isManualMode = mode === MODE_MANUAL;

if (active && isManualMode) {
  return {
    label: 'STOP MANUAL',
    accent: 'var(--dm-accent)',
    action: 'deactivate',
    processKind: null,
  };
}
```

Update the final return label:

```js
label: isManualMode ? 'START MANUAL' : isSteamMode ? 'START STEAM' : 'START SHOT',
```

- [ ] **Step 4: Map Manual status fields in ApiService**

In `web/src/services/ApiService.js`, add these fields to `newStatus` inside `_onStatus(message)`:

```js
      manualTargetType: message.mtp || 'pressure',
      manualPressure: Number.isFinite(message.mp) ? message.mp : 9,
      manualFlow: Number.isFinite(message.mf) ? message.mf : 2,
      manualTemperature: Number.isFinite(message.mt) ? message.mt : 93,
```

Add the same defaults to `machine.status`:

```js
    manualTargetType: 'pressure',
    manualPressure: 9,
    manualFlow: 2,
    manualTemperature: 93,
```

- [ ] **Step 5: Add Manual to legacy home constants**

In `web/src/utils/homeConstants.jsx`, change:

```js
export const MODE_LABELS = ['STANDBY', 'BREW', 'STEAM', 'WATER', 'GRIND', 'MANUAL'];
```

Add:

```js
  5: 'Manual control',
```

to `MODE_SUBTITLES`.

- [ ] **Step 6: Verify Web logic passes**

Run:

```powershell
cd web; node --test src/pages/Home/dashboardLogic.test.js
```

Expected: all tests pass.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add web/src/pages/Home/dashboardLogic.js web/src/pages/Home/dashboardLogic.test.js web/src/services/ApiService.js web/src/utils/homeConstants.jsx
git commit -m "Add manual mode web state plumbing"
```

## Task 2: Firmware Manual Mode Core

**Files:**
- Modify: `src/display/core/constants.h`
- Modify: `src/display/core/Settings.h`
- Modify: `src/display/core/Settings.cpp`
- Create: `src/display/core/process/ManualProcess.h`
- Modify: `src/display/core/Controller.h`
- Modify: `src/display/core/Controller.cpp`
- Modify: `src/display/plugins/WebUIPlugin.cpp`
- Modify: `src/display/plugins/ShotHistoryPlugin.cpp`

- [ ] **Step 1: Add constants and Settings API**

In `src/display/core/constants.h`, add:

```cpp
#define MODE_MANUAL 5

#define MANUAL_TARGET_PRESSURE 0
#define MANUAL_TARGET_FLOW 1
#define DEFAULT_MANUAL_TARGET_TYPE MANUAL_TARGET_PRESSURE
#define DEFAULT_MANUAL_PRESSURE 9.0f
#define DEFAULT_MANUAL_FLOW 2.0f
#define DEFAULT_MANUAL_TEMPERATURE 93
#define MIN_MANUAL_TEMPERATURE 80
#define MAX_MANUAL_TEMPERATURE 105
#define MIN_MANUAL_PRESSURE 0.0f
#define MAX_MANUAL_PRESSURE 12.0f
#define MIN_MANUAL_FLOW 0.0f
#define MAX_MANUAL_FLOW 6.0f
```

In `Settings.h`, add getters:

```cpp
    int getManualTargetType() const { return manualTargetType; }
    float getManualPressure() const { return manualPressure; }
    float getManualFlow() const { return manualFlow; }
    int getManualTemperature() const { return manualTemperature; }
```

Add setters:

```cpp
    void setManualTargetType(int target_type);
    void setManualPressure(float pressure);
    void setManualFlow(float flow);
    void setManualTemperature(int temperature);
```

Add private fields:

```cpp
    int manualTargetType = DEFAULT_MANUAL_TARGET_TYPE;
    float manualPressure = DEFAULT_MANUAL_PRESSURE;
    float manualFlow = DEFAULT_MANUAL_FLOW;
    int manualTemperature = DEFAULT_MANUAL_TEMPERATURE;
```

In `Settings.cpp`, load values in the constructor:

```cpp
    manualTargetType = preferences.getInt("mtt", DEFAULT_MANUAL_TARGET_TYPE);
    manualPressure = preferences.getFloat("mp", DEFAULT_MANUAL_PRESSURE);
    manualFlow = preferences.getFloat("mf", DEFAULT_MANUAL_FLOW);
    manualTemperature = preferences.getInt("mt", DEFAULT_MANUAL_TEMPERATURE);
    setManualTargetType(manualTargetType);
    setManualPressure(manualPressure);
    setManualFlow(manualFlow);
    setManualTemperature(manualTemperature);
    dirty = false;
```

Add setter implementations:

```cpp
void Settings::setManualTargetType(int target_type) {
    manualTargetType = target_type == MANUAL_TARGET_FLOW ? MANUAL_TARGET_FLOW : MANUAL_TARGET_PRESSURE;
    save();
}

void Settings::setManualPressure(float pressure) {
    manualPressure = std::clamp(pressure, MIN_MANUAL_PRESSURE, MAX_MANUAL_PRESSURE);
    save();
}

void Settings::setManualFlow(float flow) {
    manualFlow = std::clamp(flow, MIN_MANUAL_FLOW, MAX_MANUAL_FLOW);
    save();
}

void Settings::setManualTemperature(int temperature) {
    manualTemperature = std::clamp(temperature, MIN_MANUAL_TEMPERATURE, MAX_MANUAL_TEMPERATURE);
    save();
}
```

In `doSave()`, persist:

```cpp
    preferences.putInt("mtt", manualTargetType);
    preferences.putFloat("mp", manualPressure);
    preferences.putFloat("mf", manualFlow);
    preferences.putInt("mt", manualTemperature);
```

- [ ] **Step 2: Create ManualProcess**

Create `src/display/core/process/ManualProcess.h`:

```cpp
#ifndef MANUALPROCESS_H
#define MANUALPROCESS_H

#include <display/core/constants.h>
#include <display/core/process/BrewProcess.h>

class ManualProcess : public Process {
  public:
    unsigned long started = 0;
    unsigned long finished = 0;
    int targetType = DEFAULT_MANUAL_TARGET_TYPE;
    float pressure = DEFAULT_MANUAL_PRESSURE;
    float flow = DEFAULT_MANUAL_FLOW;
    int temperature = DEFAULT_MANUAL_TEMPERATURE;
    ProcessPhase processPhase = ProcessPhase::RUNNING;

    ManualProcess(int targetType, float pressure, float flow, int temperature)
        : targetType(targetType == MANUAL_TARGET_FLOW ? MANUAL_TARGET_FLOW : MANUAL_TARGET_PRESSURE), pressure(pressure),
          flow(flow), temperature(temperature) {
        started = millis();
    }

    bool isRelayActive() override { return isActive(); }
    bool isAltRelayActive() override { return false; }
    float getPumpValue() override { return isActive() ? 100.0f : 0.0f; }
    void progress() override {
        if (processPhase == ProcessPhase::RUNNING && millis() - started > BREW_SAFETY_DURATION_MS) {
            processPhase = ProcessPhase::FINISHED;
            finished = millis();
        }
    }
    bool isActive() override { return processPhase == ProcessPhase::RUNNING; }
    bool isComplete() override { return processPhase == ProcessPhase::FINISHED; }
    int getType() override { return MODE_MANUAL; }
    void updateVolume(double volume) override {}

    bool isPressureTarget() const { return targetType != MANUAL_TARGET_FLOW; }
    PumpTarget getPumpTarget() const {
        return isPressureTarget() ? PumpTarget::PUMP_TARGET_PRESSURE : PumpTarget::PUMP_TARGET_FLOW;
    }
    float getPumpPressure() const { return isActive() ? pressure : 0.0f; }
    float getPumpFlow() const { return isActive() ? flow : 0.0f; }
    int getTemperature() const { return temperature; }

    void updateTargets(int nextTargetType, float nextPressure, float nextFlow, int nextTemperature) {
        targetType = nextTargetType == MANUAL_TARGET_FLOW ? MANUAL_TARGET_FLOW : MANUAL_TARGET_PRESSURE;
        pressure = nextPressure;
        flow = nextFlow;
        temperature = nextTemperature;
    }
};

#endif // MANUALPROCESS_H
```

- [ ] **Step 3: Wire Controller Manual APIs**

In `Controller.h`, include no new headers in the public section, but add public methods:

```cpp
    bool isManualAvailable() const;
    void updateManualTargets(int targetType, float pressure, float flow, int temperature);
    int getManualTargetType() const { return settings.getManualTargetType(); }
    float getManualPressure() const { return settings.getManualPressure(); }
    float getManualFlow() const { return settings.getManualFlow(); }
    int getManualTemperature() const { return settings.getManualTemperature(); }
```

Add Manual fields to `ProcessSnapshot`:

```cpp
    bool isManual = false;
    int manualTargetType = DEFAULT_MANUAL_TARGET_TYPE;
    float manualPressure = 0.0f;
    float manualFlow = 0.0f;
    int manualTemperature = DEFAULT_MANUAL_TEMPERATURE;
```

In `Controller.cpp`, include:

```cpp
#include <display/core/process/ManualProcess.h>
```

Add:

```cpp
bool Controller::isManualAvailable() const { return systemInfo.capabilities.pressure; }
```

In `getTargetTemp()`, add Manual fallback and switch cases returning `settings.getManualTemperature()`.

In `setTargetTemp()`, add:

```cpp
    case MODE_MANUAL:
        settings.setManualTemperature(static_cast<int>(temperature));
        break;
```

In `activate()`, add:

```cpp
    case MODE_MANUAL:
        if (!isManualAvailable())
            return;
        startProcess(new ManualProcess(settings.getManualTargetType(), settings.getManualPressure(), settings.getManualFlow(),
                                       settings.getManualTemperature()));
        break;
```

In `setMode()`, reject unavailable Manual:

```cpp
    if (newMode == MODE_MANUAL && !isManualAvailable())
        return;
```

Add method:

```cpp
void Controller::updateManualTargets(int targetType, float pressure, float flow, int temperature) {
    settings.setManualTargetType(targetType);
    settings.setManualPressure(pressure);
    settings.setManualFlow(flow);
    settings.setManualTemperature(temperature);
    setTargetTemp(settings.getManualTemperature());

    if (xSemaphoreTake(processMutex, pdMS_TO_TICKS(UI_MUTEX_TIMEOUT_MS)) != pdTRUE) {
        ESP_LOGW(LOG_TAG, "Mutex timeout in updateManualTargets");
        return;
    }

    if (currentProcess != nullptr && currentProcess->getType() == MODE_MANUAL) {
        auto *manual = static_cast<ManualProcess *>(currentProcess);
        manual->updateTargets(settings.getManualTargetType(), settings.getManualPressure(), settings.getManualFlow(),
                              settings.getManualTemperature());
    }

    xSemaphoreGive(processMutex);
    updateLastAction();
}
```

In `updateControl()`, copy Manual data while holding the mutex and send advanced output when active Manual:

```cpp
    bool manualTargetIsPressure = true;
    float manualPumpPressure = 0.0f;
    float manualPumpFlow = 0.0f;
```

Inside `if (active)`:

```cpp
        if (procType == MODE_MANUAL) {
            auto *manualProcess = static_cast<ManualProcess *>(proc);
            manualTargetIsPressure = manualProcess->isPressureTarget();
            manualPumpPressure = manualProcess->getPumpPressure();
            manualPumpFlow = manualProcess->getPumpFlow();
            targetTemp = manualProcess->getTemperature();
        }
```

In the target temp fallback switch, add Manual.

Before the final simple `sendOutputControl`, add:

```cpp
        if (procType == MODE_MANUAL) {
            targetPressure = manualPumpPressure;
            targetFlow = manualPumpFlow;
            clientController.sendAdvancedOutputControl(relayActive, targetTemp, manualTargetIsPressure, manualPumpPressure,
                                                       manualPumpFlow);
            return;
        }
```

In `getProcessSnapshot()`, populate Manual:

```cpp
        } else if (proc->getType() == MODE_MANUAL) {
            auto *manual = static_cast<ManualProcess *>(proc);
            snapshot.isManual = true;
            snapshot.started = manual->started;
            snapshot.finished = manual->finished;
            snapshot.manualTargetType = manual->targetType;
            snapshot.manualPressure = manual->pressure;
            snapshot.manualFlow = manual->flow;
            snapshot.manualTemperature = manual->temperature;
```

- [ ] **Step 4: Wire WebSocket status and updates**

In `WebUIPlugin.cpp`, add status fields:

```cpp
        doc["mtp"] = controller->getManualTargetType() == MANUAL_TARGET_FLOW ? "flow" : "pressure";
        doc["mp"] = controller->getManualPressure();
        doc["mf"] = controller->getManualFlow();
        doc["mt"] = controller->getManualTemperature();
```

In `req:change-mode`, reject unavailable Manual:

```cpp
            if (newMode == MODE_MANUAL && !controller->isManualAvailable())
                return;
```

Add handler before `req:change-mode` or after temp handlers:

```cpp
    } else if (msgType == "req:manual:update") {
        if (controller->getMode() != MODE_MANUAL || !controller->isManualAvailable())
            return;
        int targetType = controller->getManualTargetType();
        if (doc["targetType"].is<const char *>()) {
            String requestedType = doc["targetType"].as<const char *>();
            targetType = requestedType == "flow" ? MANUAL_TARGET_FLOW : MANUAL_TARGET_PRESSURE;
        }
        float pressure = doc["pressure"].is<float>() ? doc["pressure"].as<float>() : controller->getManualPressure();
        float flow = doc["flow"].is<float>() ? doc["flow"].as<float>() : controller->getManualFlow();
        int temperature = doc["temperature"].is<int>() ? doc["temperature"].as<int>() : controller->getManualTemperature();
        controller->updateManualTargets(targetType, pressure, flow, temperature);
```

In process status serialization, add Manual:

```cpp
            } else if (proc.isManual) {
                unsigned long ts = proc.isActive ? millis() : proc.finished;
                pObj["s"] = "manual";
                pObj["l"] = proc.isActive ? "Manual" : "Finished";
                pObj["e"] = ts - proc.started;
                pObj["tt"] = proc.manualTargetType == MANUAL_TARGET_FLOW ? "flow" : "pressure";
                pObj["pt"] = proc.manualTargetType == MANUAL_TARGET_FLOW ? proc.manualFlow : proc.manualPressure;
                pObj["pp"] = proc.manualTargetType == MANUAL_TARGET_FLOW ? controller->getCurrentPumpFlow()
                                                                          : controller->getCurrentPressure();
            }
```

- [ ] **Step 5: Record Manual shots**

In `ShotHistoryPlugin.cpp`, update `initializeHeader()`:

```cpp
    if (controller->getMode() == MODE_MANUAL || controller->getProcessType() == MODE_MANUAL) {
        strncpy(header.profileId, "manual", sizeof(header.profileId) - 1);
        header.profileId[sizeof(header.profileId) - 1] = '\0';
        strncpy(header.profileName, "Manual", sizeof(header.profileName) - 1);
        header.profileName[sizeof(header.profileName) - 1] = '\0';
        return;
    }
```

Update recording guard:

```cpp
    if (!controller || ((controller->getMode() != MODE_BREW && controller->getMode() != MODE_MANUAL) && !extendedRecording)) {
```

Update early start utility guard to only skip brew utility:

```cpp
    if (controller->getProcessType() == MODE_BREW && controller->isBrewProcessUtility()) {
```

Update `currentProfileName` assignment:

```cpp
    currentProfileName = controller->getProcessType() == MODE_MANUAL ? "Manual"
                                                                     : controller->getProfileManager()->getSelectedProfile().label;
```

Update `createEarlyIndexEntry()` similarly for manual profile id/name.

- [ ] **Step 6: Verify firmware compile syntax**

Run:

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\platformio.exe" run -e display
```

Expected: compile succeeds. If PlatformIO is unavailable or hangs, run `git diff --check` and report the firmware build status explicitly.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add src/display/core/constants.h src/display/core/Settings.h src/display/core/Settings.cpp src/display/core/process/ManualProcess.h src/display/core/Controller.h src/display/core/Controller.cpp src/display/plugins/WebUIPlugin.cpp src/display/plugins/ShotHistoryPlugin.cpp
git commit -m "Add firmware manual mode core"
```

## Task 3: Manual Dashboard Console

**Files:**
- Modify: `web/src/pages/Home/DashboardMerged.jsx`
- Optionally modify: `web/src/style.css` only if inline styles cannot cover responsive layout cleanly.

- [ ] **Step 1: Add Manual UI helpers and imports**

In `DashboardMerged.jsx`, import from `dashboardLogic.js`:

```js
  MODE_MANUAL,
  MANUAL_TARGET_FLOW,
  clampManualFlow,
  clampManualPressure,
  clampManualTemperature,
  getManualControlLabels,
```

Add a local helper component near the other sub-components:

```jsx
function ManualControlRow({ label, current, target, unit, min, max, step, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--dm-fg-dim)' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 10, color: 'var(--dm-fg)' }}>
          {fmt(current)} / {fmt(target)} {unit}
        </span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={target}
        onInput={event => onChange(Number(event.currentTarget.value))}
        style={{ width: '100%', accentColor: 'var(--dm-accent)' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add Manual derived state and update sender**

Near the existing sensor value derivation, add:

```js
  const isManualMode = mode === MODE_MANUAL;
  const manualTargetType = s.manualTargetType === MANUAL_TARGET_FLOW ? MANUAL_TARGET_FLOW : 'pressure';
  const manualPressure = clampManualPressure(s.manualPressure ?? 9);
  const manualFlow = clampManualFlow(s.manualFlow ?? 2);
  const manualTemperature = clampManualTemperature(s.manualTemperature ?? 93);
  const manualLabels = getManualControlLabels(manualTargetType);
```

Add:

```js
  const sendManualUpdate = useCallback(
    updates => {
      api.send({
        tp: 'req:manual:update',
        targetType: manualTargetType,
        pressure: manualPressure,
        flow: manualFlow,
        temperature: manualTemperature,
        ...updates,
      });
    },
    [api, manualTargetType, manualPressure, manualFlow, manualTemperature]
  );
```

In `primaryAction`, when `primaryActionState.action === 'start-process'`, keep `actions.activate()` so Manual uses the existing `req:process:activate`.

- [ ] **Step 3: Render Manual console instead of recipe panel**

In the right panel, render the existing recipe/targets content only when `!isManualMode`. When `isManualMode`, render:

```jsx
<>
  <div style={{ fontFamily: 'var(--dm-font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--dm-fg-dim)' }}>
    MANUAL CONTROL
  </div>

  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    {['pressure', 'flow'].map(type => (
      <button
        key={type}
        type='button'
        onClick={() => sendManualUpdate({ targetType: type })}
        style={{
          padding: '8px 10px',
          borderRadius: 6,
          border: `1px solid ${manualTargetType === type ? 'var(--dm-accent)' : 'var(--dm-line)'}`,
          background: manualTargetType === type ? 'color-mix(in srgb, var(--dm-accent) 12%, transparent)' : 'transparent',
          color: manualTargetType === type ? 'var(--dm-accent)' : 'var(--dm-fg-dim)',
          fontFamily: 'var(--dm-font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          cursor: 'pointer',
        }}
      >
        {type.toUpperCase()}
      </button>
    ))}
  </div>

  <ManualControlRow
    label={manualLabels.pressure}
    current={pressure}
    target={manualPressure}
    unit='bar'
    min={0}
    max={12}
    step={0.1}
    onChange={value => sendManualUpdate({ pressure: clampManualPressure(value) })}
  />
  <ManualControlRow
    label={manualLabels.flow}
    current={flowVal}
    target={manualFlow}
    unit='g/s'
    min={0}
    max={6}
    step={0.1}
    onChange={value => sendManualUpdate({ flow: clampManualFlow(value) })}
  />
  <ManualControlRow
    label='TEMPERATURE'
    current={tempVal}
    target={manualTemperature}
    unit='C'
    min={80}
    max={105}
    step={1}
    onChange={value => sendManualUpdate({ temperature: clampManualTemperature(value) })}
  />

  <button type='button' onClick={primaryAction} style={/* reuse existing primary action style */}>
    {primaryActionLabel}
  </button>
</>
```

Extract the existing primary action button style into a shared local `primaryActionButtonStyle` object and use that object for both the normal recipe panel button and the Manual console button. The result must preserve layout dimensions and not nest cards.

- [ ] **Step 4: Adjust target visuals for Manual**

When `isManualMode`, use Manual defaults for target ticks/bars:

```js
  const displayTargetPressure = isManualMode ? manualPressure : targetPressure;
  const displayTargetFlow = isManualMode ? manualFlow : targetFlow;
  const displayTargetTemp = isManualMode ? manualTemperature : targetTemp;
```

Use these display targets for ring ticks and target bars. Keep active target pressure/flow lines from `status.targetPressure` / `status.targetFlow` in the graph history because those represent actual output.

- [ ] **Step 5: Verify Web UI build and lint**

Run:

```powershell
cd web; node --test src/pages/Home/dashboardLogic.test.js
cd web; npm run build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add web/src/pages/Home/DashboardMerged.jsx web/src/style.css
git commit -m "Add manual mode dashboard console"
```

## Task 4: Final Verification And Polish

**Files:**
- Modify only files required to fix verification failures.

- [ ] **Step 1: Run focused Web tests**

Run:

```powershell
cd web; node --test src/pages/Home/dashboardLogic.test.js
```

Expected: pass.

- [ ] **Step 2: Run Web build**

Run:

```powershell
cd web; npm run build
```

Expected: pass.

- [ ] **Step 3: Run firmware build**

Run:

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\platformio.exe" run -e display
```

Expected: pass, or document if PlatformIO hangs/unavailable.

- [ ] **Step 4: Run diff hygiene**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; branch has only intended changes.

- [ ] **Step 5: Commit verification fixes if needed**

If verification required code changes:

```powershell
git status --short
git add web/src/pages/Home/dashboardLogic.js web/src/pages/Home/dashboardLogic.test.js web/src/services/ApiService.js web/src/utils/homeConstants.jsx web/src/pages/Home/DashboardMerged.jsx web/src/style.css src/display/core/constants.h src/display/core/Settings.h src/display/core/Settings.cpp src/display/core/process/ManualProcess.h src/display/core/Controller.h src/display/core/Controller.cpp src/display/plugins/WebUIPlugin.cpp src/display/plugins/ShotHistoryPlugin.cpp
git commit -m "Polish manual mode implementation"
```

If no fixes were needed, do not create an empty commit.
