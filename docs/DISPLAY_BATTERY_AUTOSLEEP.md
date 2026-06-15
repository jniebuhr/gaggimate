# Display: no-controller auto-sleep + battery indicator

**Scope: display firmware only (LilyGo T-RGB, `env:display`).**
No changes to the controller firmware, coffee-control logic (heater/pump/valve/pressure/
temperature), profile schema/engine, BLE control commands, bootloader, partition table,
eFuse, Secure Boot, or Flash Encryption.

Base: forked from `jniebuhr/gaggimate` upstream `master` @ `591abe74`.

---

## Goals

1. **Auto-sleep when no controller** — if the display has no BLE connection to the
   GaggiMate Controller (PCB) for **120 s**, it enters deep sleep to save battery. It
   wakes on **touch** (the chip reboots and re-scans for the controller).
2. **Battery indicator** — show the single-cell 3.7 V Li-ion state (approx. percentage
   **and** voltage) on the display.
3. **Official firmware stays recoverable** — no bootloader/partition/flash-security
   changes; re-flash the official build to revert.

---

## What changed (display-only)

| File | Change |
|------|--------|
| `src/display/core/constants.h` | Auto-sleep + battery default constants |
| `src/display/drivers/Driver.h` | Add `sleep()`, `hasBattery()`, `getBatteryMilliVolts()` (default no-op / 0) |
| `src/display/drivers/LilyGoDriver.h` | Implement them via `panel.enableTouchWakeup()/sleep()` and `panel.getBattVoltage()` |
| `src/display/core/AutoSleepManager.h` | New pure-logic module: no-controller sleep policy |
| `src/display/core/BatteryMonitor.h` | New pure-logic module: voltage → approx. % (piecewise LUT) |
| `src/display/core/Settings.{h,cpp}` | `autoSleepNoController` (default on) + `noControllerSleepTimeout` (default 120 s) |
| `src/display/plugins/WebUIPlugin.cpp` | Read/serialize the two new settings via the existing config API |
| `src/display/ui/default/DefaultUI.{h,cpp}` | Drive both managers; battery overlay on the LVGL top layer |
| `sim/driver/SdlDriver.h` | Mock battery (`GM_SIM_BATTERY_MV`, default 3900) + mock sleep (logs, never exits) |

No new BLE commands. The display only **reads** BLE connection state and **never**
sends standby/brew/stop/valve/pump/heater commands before sleeping.

---

## Behaviour

### Auto-sleep (`AutoSleepManager`)
- Countdown starts at boot and whenever the controller disconnects.
- Reconnect within the timeout cancels it.
- Touch resets the UI idle timer but does **not** block the no-controller countdown.
- Suppressed during OTA / firmware update / Wi-Fi AP setup / autotune.
- If the battery is **critical** (< 3400 mV) and no controller, it sleeps after ¼ of the timeout.
- Configurable: `Settings.autoSleepNoController` (on/off) and `noControllerSleepTimeout`
  (the web config API accepts seconds; suggested presets 1 / 2 / 5 / 10 min). Compile-time
  defaults live in `constants.h`.

### Battery (`BatteryMonitor`)
- Sampled every 30 s via `Driver::getBatteryMilliVolts()` → on the T-RGB this is
  `panel.getBattVoltage()`, which averages ~20 ADC reads on `BOARD_ADC_DET` (GPIO4) and
  already accounts for the on-board 1/2 divider.
- Percentage is an **approximation** (coarse Li-ion LUT, 3400 mV = 0 %, 4200 mV = 100 %);
  the raw voltage is shown next to it on purpose.
- Shown on every screen as a small overlay on the LVGL top layer: `<icon> NN% N.NNV`,
  white normally, amber < 3500 mV, red < 3400 mV.

> **USB caveat:** when USB-C is connected the reading reflects the charging voltage, so it
> does **not** represent the true remaining battery charge. Treat on-screen battery as
> meaningful only on battery power.

---

## Build / test

> Note: PlatformIO's `display-sim` env breaks if the project path contains a **space**
> (unquoted `-I ${PROJECT_DIR}/sim/...` flags). Build the sim from a space-free path.
> The device `display` env builds fine regardless. The build scripts need **Python 3.11+**
> (`datetime.UTC`).

```bash
# Device firmware
pio run -e display

# Static analysis
pio check -e display

# Simulator (from a path without spaces)
pio run -e display-sim -t run
# simulate battery levels:
GM_SIM_BATTERY_MV=3400 pio run -e display-sim -t run
# format
scripts/format.sh
```

### Manual test checklist (real T-RGB)
1. Display on battery, controller off → "waiting", battery visible, **sleeps after 120 s**, wakes on touch.
2. Controller turned on within 120 s → connects, does **not** sleep.
3. Connected, then controller off → "waiting", sleeps after 120 s.
4. Controller back within 120 s → does **not** sleep.
5. USB to a PC → flashes, serial logs OK; auto-sleep can be disabled via the setting while debugging.
6. Simulator → mock battery visible; `[sim] AutoSleep: enterDisplaySleep() (mock, not sleeping)` logged instead of exiting.

---

## Recovery

Auto-sleep is a setting (default on) — turn it off in the web config to disable. To fully
revert, re-flash the official display firmware from <https://docs.gaggimate.eu/docs/flashing/>.
Nothing in bootloader / partitions / flash security is touched.
