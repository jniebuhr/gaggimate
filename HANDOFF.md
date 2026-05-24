# Gaggimate — profile-stability / perf / browser-compat branch

**Status:** WIP. Not yet validated on production hardware end-to-end. Treat this
as a thinking-out-loud draft, not a PR-ready change set. Individual commits are
intentionally small so a maintainer can cherry-pick the ones that look right.

**Base:** commit `a3848e62` ("fix: Responsive fixes") on upstream `master`,
which is `v1.8.1-34-ga3848e62` per `git describe` and also tagged `nightly`.

**Author note:** I'm not a maintainer of this project. I'm a Gaggimate owner
who hit a series of bugs (profile import errors, slow web UI, blank profile
cards, system freezes, browser compatibility on an iPad Air 2) and used Claude
Code to track them down. The branch captures everything I tried that helped;
the diagnoses are documented in commit messages so you can evaluate each
change on its own.

---

## What this branch addresses

Symptoms hit, in roughly the order I diagnosed them:

1. **Profile import was producing garbage** — Decent Espresso `.tcl` and
   Meticulous Espresso `.json` profiles imported via the web UI either lost
   fields silently or, for Meticulous, never imported at all (the entry guard
   on the import path checked for a field that doesn't exist in any real
   Meticulous profile).
2. **System became inconsistent with many profiles on SD card** — profile
   list would partially populate then show blank "Simple" cards, page
   eventually locked up, sometimes a reboot was the only recovery. Worse with
   more profiles, regardless of storage backend.
3. **"Default" profiles accumulated on every boot** with intermittent SD
   reads — duplicate Defaults piling up in the favourites list.
4. **iPad Air 2 (Safari 15) couldn't use the Profiles page** — kebab menus
   never appeared, volumetric badge always said `0g`, page would partially
   render then freeze.
5. **Slow asset loading + intermittent stalls on M-series macOS** — entry
   chunk taking 30+ seconds, individual responses stalling at 2–5 KB / 30 s,
   ping RTT spiking to 200–700 ms on the same WiFi where the router pings
   back in ~3 ms. Device reports 70 % internal heap used + 33 % fragmentation
   in the System & Updates panel.
6. **WebSocket force-closing during slow disk I/O** —
   `AsyncWebSocket._queueMessage(): Too many messages queued: closing
   connection` in serial logs, killing the live page.

---

## Fixes, by area

### Profile import converters (`web/src/pages/ProfileList/`)

- **`utils.js`**: replaced `parseJsonProfile` with `convertMeticulousProfile`
  written against the actual Meticulous schema
  ([`espresso-profile-schema`](https://github.com/MeticulousHome/espresso-profile-schema)).
  Uses `stages` / `dynamics{points,over,interpolation}` / `exit_triggers` /
  `limits` / `final_weight` / `variables`. Resolves `$varname`
  references. The previous code read `waterTemperature` / `phases` /
  `stopConditions` / `restriction` / `waterPumpedInPhase` — none of which
  exist in any Meticulous profile, so the function returned the raw input
  unchanged on every real import.
- **`TclConverter.js`**: handles `settings_2b` (flow simple) profiles, which
  the previous parser tried to read with pressure semantics and discarded
  every flow value; normalises legacy profile-type names
  (`settings_2c2`, `settings_profile_advanced`, etc.) via DE's own
  `fix_profile_type` mapping; uses `final_desired_shot_volume_advanced_count_start`
  to split preinfusion vs brew (was name-keyword sniffing); reads per-phase
  `weight` stop; prefers `final_desired_shot_weight_advanced` for advanced
  profiles; pushes the shot-weight target onto the last brew phase only
  (was pushed onto every phase, breaking preinfusion); fixes `Math.max(...)`
  duration calc that produced NaN on missing `stopConditions`; fixes
  `.replace('_', '-')` only replacing the first underscore; clamps phase
  duration to schema minimum 0.5 s; uses finite-check instead of
  `parseFloat(x) || -1` so explicit `0` setpoints aren't coerced to the
  "hold current" sentinel; decline phase now ramps via a linear transition
  instead of stepping straight to the end pressure; reads `espresso_temperature`
  only when present so missing value doesn't zero the default 93 °C.

### Firmware profile loading reliability

- **`src/display/core/ProfileManager.cpp` — `listProfiles()`**: explicitly
  closes the root directory File handle on every return path (and each inner
  file). Without this, every list call leaks a directory handle; SPIFFS's
  small open-file table exhausts within ~30 calls and subsequent
  `loadProfile()` open() calls silently fail. This is the primary cause of
  "blank cards" and "profiles disappear with many on SD" reports. Not
  surfaced in upstream issues.
- **`src/display/core/ProfileManager.cpp` — `setup()`/`migrate()`**: calls
  `listProfiles()` once and passes the result; `migrate()` now scans for an
  existing "Default" profile before creating a new one. Without this, every
  transient SD read failure (`sdmmc_init_ocr ... returned 0x107`) triggers
  `migrate()` → fresh Default → favourites list grows. The `0x107` error
  isn't documented in upstream
  [troubleshooting](https://github.com/jniebuhr/gaggimate-docs/blob/master/src/pages/docs/troubleshooting.mdx).
- **`src/display/models/profile.h` — `parseProfile()`**: validates `label`,
  `type`, `phases` are present and well-typed, and that at least one phase
  parses. Logs the rejecting profile id and which field failed. Previously
  always returned `true`, so a truncated or corrupt JSON silently became a
  Profile with empty strings and zero floats — UI showed garbage and the
  brew loop ran against zero-duration phases.
- **`src/display/core/utils.cpp` — `generateShortID()`**: uses `esp_random()`
  per character instead of `randomSeed(micros() ^ ...)` then `random()`. Old
  code collides if two IDs are generated in the same millisecond (bulk
  import, batch ops).

### Firmware web server reliability

- **`src/display/plugins/WebUIPlugin.cpp`**: list handler skips profiles
  where `loadProfile()` fails instead of emitting an empty `{id:"", label:""}`
  entry. Without this, dying SD blocks → loadProfile false → blank "Simple"
  cards in the UI (the symptom that triggered this whole investigation).
- **`onNotFound`** returns a real 404 for `/assets/*` and `/api/*` paths
  instead of serving `index.html`. The old behaviour silently broke the SPA
  whenever the SPIFFS partition was updated: Vite content-hashes change, the
  browser-cached `index.html` requests the old hash, server returned HTML
  for the JS path, browser executed HTML as JavaScript, no errors logged,
  page stuck on shell. Possibly related to upstream issue
  [#650](https://github.com/jniebuhr/gaggimate/issues/650) (LittleFS
  serveStatic hangs).
- **Static cache headers**: `Cache-Control: public, max-age=31536000, immutable`
  for `/assets/*` (content-addressed by Vite, safe to cache forever);
  `no-store` for everything else (index.html must always revalidate so a
  bundle update is picked up).
- **`setCloseClientOnQueueFull(false)`** on every connect — drop the message,
  keep the connection. Default `true` makes `_queueMessage` call
  `_client->close()` from the tcpip callback, which tears the client down
  mid-`AsyncMiddlewareChain::_runChain` (LoadProhibited at EXCVADDR 0x14).
  Upstream report: [ESPAsyncWebServer#433](https://github.com/ESP32Async/ESPAsyncWebServer/issues/433).
  Possibly the root cause of upstream issue
  [#420](https://github.com/jniebuhr/gaggimate/issues/420) (web UI
  unreachable in standby) and [#540](https://github.com/jniebuhr/gaggimate/issues/540)
  (WiFi disconnect after brew shot).

### Firmware memory management

- **PSRAM allocator for response JsonDocs**: introduced a `PsramAllocator`
  in `WebUIPlugin.cpp` (heap_caps_malloc with `MALLOC_CAP_SPIRAM`, falls
  back to internal). The profile-list response can be 20–60 KB and was
  fragmenting the ~300 KB internal heap. ESP32-S3 has 8 MB PSRAM almost
  entirely idle (LVGL holds only a few frame buffers).
- **`statusDoc` reused via `clear()`**: the 500 ms status broadcast used to
  allocate a fresh `JsonDocument` each tick. Reusing the same doc lets the
  underlying pool grow once and stay put.
- **Status broadcast skips clients with backlogged queue**: per-client
  `client.queueIsFull()` / `queueLen() < 8` check before `client.text()`.
- This is conceptually the same problem space as PR
  [#681](https://github.com/jniebuhr/gaggimate/pull/681) (move NimBLE host
  + LWIP to PSRAM via sdkconfig) but achieved at the application layer so
  it can ship without the toolchain migration that #681 introduces. Both
  approaches stack — if/when #681 lands the application-level allocator is
  still useful for the response docs.

### Firmware BLE / WiFi coexistence

- **`lib/NimBLEComm/src/NimBLEClientController.cpp` — `scan()`**: switched
  to passive scan, dropped duty cycle from 100 ms window / 2 s interval
  (5 %) to 50 ms window / 4 s interval (1.25 %). On ESP32-S3 the single
  2.4 GHz radio is time-shared between WiFi and BLE; active scan with TX
  scan-requests was holding the radio long enough to spike WiFi RTT into
  the 200–700 ms range and cause asset-serve stalls. Discovery still works,
  just slightly slower.
- **`platformio.ini` — `-DCONFIG_ASYNC_TCP_RUNNING_CORE=1`**: moved
  AsyncTCP off core 0 where NimBLE host runs. Reduces task-level contention
  on top of the radio-level reduction above.

### Firmware misc

- **`src/display/plugins/ShotHistoryPlugin.cpp`**: closes the history
  directory File handle on all return paths in `req:history:list` and
  `rebuildIndex()`; closes the per-iteration file handle. Same handle-leak
  pattern as `listProfiles`.

### Web UI browser compatibility

- **`web/src/pages/ProfileList/index.jsx`**: replaced the HTML5
  [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
  (`<div popover='auto'>`, `showPopover()`, `:popover-open`) with a
  state-driven conditional render + manual document-click outside handler.
  Popover API requires Safari 17 / Firefox 125; previously the kebab menu
  was dead on Safari 15 (iPad Air 2 caps at iOS 15.8.4) and Firefox ESR.
  Replaced `data.phases.at(-1)` with `data.phases[data.phases.length - 1]`
  — `Array.prototype.at()` with negative index needs Safari 15.4+. Both
  fixes help every browser, not just the iPad.
- **`web/index.html`**: inline `<script>` that reads
  `gaggimate-daisyui-theme` from localStorage and sets `data-theme`
  synchronously before any module loads. Eliminates the light-mode FOUC
  flash during the (still substantial) bundle download.

### Web UI list-page reliability + perf

- **Minimal-mode profile list** + **lazy-load chart per card with concurrency
  3**: list response carries only metadata (id, label, type, description,
  temperature, favorite, selected, utility, totalDuration, totalVolume,
  phaseCount). Each `ProfileCard` issues its own `req:profiles:load` for
  the full data when it mounts, gated through a shared module-level queue
  with `PROFILE_LOAD_CONCURRENCY = 3`. Together: fast first paint, charts
  populate over the next ~2 s, no single huge response, no AsyncTCP queue
  overflow.
- **Guard every `data.phases` access** on the card so a minimal-mode
  payload renders cleanly while full data is in flight. (`hasPhases`,
  `phaseCount`, `volumetricTargetGrams` fall back to the minimal fields.)
- **`onDuplicate` / `onExport`** rewritten to call `req:profiles:load`
  per profile (sequentially) instead of relying on the bulk list response.

### Web build / packaging

- **`web/vite.config.js`**: `entryFileNames` / `chunkFileNames` /
  `assetFileNames` set to `assets/[hash].{js,css,ext}` (hash only — no
  module name prefix). SPIFFS caps path length at 32 chars and silently
  drops files whose path exceeds it; default Vite names like
  `assets/chartjs-plugin-annotation.esm-_AL1m4_O.js.gz` blow past that and
  never make it onto the device. After flashing such a build, the served
  `index.html` referenced JS files that didn't exist on the SPIFFS — pure
  silent breakage. This is novel territory; not in the upstream tracker.
- **`web/src/index.jsx`**: route-based code splitting via
  `preact-iso/lazy`. The previous monolithic ~1.14 MB / 359 KB-gzip
  entry chunk took 22–34 s to download. After splitting, entry is ~58 KB
  gzipped (~2.8 s). Each page (`ProfileList`, `ProfileEdit`, `ShotAnalyzer`,
  `Statistics`, etc.) loads on demand.

---

## Measured impact (single ESP32-S3 board, internal SPIFFS only, no SD)

| Metric | Before | After |
|---|---|---|
| First-byte time (`/`) | varies, often >1 s | ~0.1 s |
| Entry chunk download | 22–34 s (one 359 KB chunk) | ~2.8 s (~58 KB gzipped) |
| Ping RTT avg / max | 214 / 678 ms | 105 / 347 ms |
| Ping packet loss | 16 % | 0 % |
| Asset download success | ~60 % (others stall mid-flight) | 100 % |
| Profile list w/ 50 profiles | ~60 KB single response, sometimes blank cards, occasional lockup | ~10 KB minimal + 50 × ~2 KB lazy loads, no blanks |

Not yet measured: internal heap fragmentation post-fix (the System &
Updates panel showed 70 % used + 33 % fragmented before). Worth re-running
once a build is in a long-running deployment.

---

## Known open items / risks

- **Not tested on real hardware end-to-end yet.** Building blocks were
  individually verified on a desktop browser + spare board, but I haven't
  done a full session — actual brew with the controller box, BLE scale,
  long-running stability — on a production setup. Treat as draft.
- **`Controller::setup()` SPIFFS-mount validation** — flagged in audit but
  not implemented. Current code logs SPIFFS mount failure and continues
  with a non-functional FS pointer; should `ESP.restart()` instead.
  (Tracked but skipped this round.)
- **ShotAnalyzer / LibraryService still requests non-minimal profile list.**
  Same payload-size symptom as ProfileList had — needs the same lazy-load
  refactor.
- **SD card behaviour with dying media.** Even with the handle-leak fix,
  a flaky card will produce `sdmmc_read_blocks failed (257)` storms.
  Recommend a UI surface for "X profiles couldn't be loaded — check SD
  card" or similar.
- **Vite hash-only filenames lose readability** in DevTools / source
  maps. Acceptable for a project where SPIFFS pathname width is fixed,
  but worth noting in a PR description.
- **Popover-replacement scroll/resize positioning** has been smoke-tested
  but not extensively. Floating-UI is probably the right long-term
  answer.
- **The merge with PR
  [#681](https://github.com/jniebuhr/gaggimate/pull/681) was attempted in
  a separate worktree and abandoned** for this draft — the dual-framework
  toolchain migration is invasive and would benefit from being a
  prerequisite landed first.

---

## Related upstream issues / PRs

- [#420](https://github.com/jniebuhr/gaggimate/issues/420) — Web UI
  unreachable in standby (open). Possibly fixed by the queue-overflow
  no-close change.
- [#540](https://github.com/jniebuhr/gaggimate/issues/540) — WiFi
  disconnect after brew shot (open). Possibly fixed by the BLE/AsyncTCP
  coex changes.
- [#572](https://github.com/jniebuhr/gaggimate/issues/572) — SD migration
  feature request. Adjacent.
- [#571](https://github.com/jniebuhr/gaggimate/issues/571) — Data loss on
  OTA. Adjacent.
- [#650](https://github.com/jniebuhr/gaggimate/issues/650) — `serveStatic`
  hangs on LittleFS .slog files (open). Same asset-serve symptom space.
- [#677](https://github.com/jniebuhr/gaggimate/pull/677) (closed),
  [#681](https://github.com/jniebuhr/gaggimate/pull/681) (open) — Move
  BT/LWIP to PSRAM via sdkconfig. Complementary to the application-level
  PSRAM allocator here.
- [#678](https://github.com/jniebuhr/gaggimate/pull/678) (merged) — BLE
  null-pointer guard + HomeKit re-init fix + OTA HTTPClient timeout typo.
  Unrelated.
- [#696](https://github.com/jniebuhr/gaggimate/pull/696) (draft) — Loops
  to tasks; reviewers flagged SmartGrindPlugin blocking HTTP from event
  handlers.
- [#704](https://github.com/jniebuhr/gaggimate/pull/704) — Move BLE
  notification handling into main loop context.
- [#263](https://github.com/jniebuhr/gaggimate/issues/263) (closed) —
  WebSocket connection spam at boot. v1.6.0.

---

## Branch layout

Commits are intentionally small and grouped by area. Each commit message
describes the bug, the fix, and the test path. Cherry-pick the ones that
look right. Read newest → oldest (top → bottom is most recent first).

```
docs: HANDOFF.md
perf(web): route code-splitting + hash-only Vite chunk filenames
fix(web/compat): Popover API removal + Array.at + theme FOUC + Navigation
perf(firmware/build): pin AsyncTCP to core 1
perf(firmware/ble-coex): passive scan + lower duty cycle
fix+perf(firmware/web): asset fallback, cache, queue survival, PSRAM JSON
fix(firmware/profile): close file handles, dedup Default, validate JSON
chore: ignore .DS_Store and local profile-import fixtures        (67abebd0+)
fix(web): Repair profile import conversions for DE and Meticulous  (67abebd0 — the import-fix commit)
```

The bottom-most commit (`fix(web): Repair profile import conversions for
DE and Meticulous`) is the original profile-import work: the rewrite of
`utils.js` against the real Meticulous schema and the deep changes to
`TclConverter.js` for Decent profiles. Everything above it is the
follow-on firmware-stability + perf + browser-compat work.
