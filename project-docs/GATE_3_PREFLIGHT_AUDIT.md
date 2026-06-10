# GATE_3_PREFLIGHT_AUDIT.md

## Purpose

This document records the repository-side Gate 3 preflight audit for the GaggiMate-hosted GaggiGo PWA architecture.

The audit was performed before target-device runtime validation to separate proven build/deployment facts from remaining runtime unknowns.

---

## Status

```text
COMPLETE
```

Result:

```text
PASS
```

The repository proves that the intended deployment architecture is not external hosting.

The application build is packaged into the GaggiMate filesystem image and served by GaggiMate itself.

---

## Local Packaging Validation

Additional validation completed on Windows development environment:

```text
npm ci: PASS
npm run build: PASS
PWA build generation: PASS
sw.js generated: PASS
workbox generated: PASS
dist copied into data/w: PASS
index.html present in data/w: PASS
app.webmanifest present in data/w: PASS
sw.js present in data/w: PASS
assets present in data/w: PASS
```

Not completed:

```text
PlatformIO buildfs
```

Reason:

```text
pio executable unavailable in current shell environment.
```

Result:

```text
Local packaging validation: PARTIAL PASS
Target-device validation still required.
```

---

## Validated Architecture

The validated architecture is:

```text
GaggiMate ESP32
= firmware runtime
= API authority
= Web UI host
= SPIFFS filesystem host

GaggiGo layer
= embedded frontend/PWA layer
= cache-first observer layer
= IndexedDB mirror
= offline History / Analyzer / Statistics / Archive layer
```

Normal users should not need to:

```text
visit GitHub
install from GitHub Pages
install a second app manually
keep a PC running
understand the build pipeline
```

The PC is a development/build tool only.

It is not part of the runtime architecture.

---

## Proven Build Chain

Repository audit confirmed the following build chain:

```text
web source
↓
Vite build
↓
web/dist
↓
scripts/build_spiffs.sh
↓
data/w
↓
PlatformIO buildfs
↓
.pio/build/display/spiffs.bin
↓
out/display-filesystem.bin
↓
flashed GaggiMate ESP32 filesystem
↓
SPIFFS:/w
↓
WebUIPlugin serves the app shell
```

---

## Evidence: scripts/build_spiffs.sh

The script performs the frontend-to-filesystem copy:

```bash
rm -rf data/w
mkdir -p data/w
mkdir -p data/p

cd web || exit
npm ci
npm run build

cp -R dist/* ../data/w/
gzip ../data/w/assets/*.js
gzip ../data/w/assets/*.css
gzip ../data/w/*.html
```

This proves that the production frontend build is copied into:

```text
data/w
```

which becomes the web app folder in the firmware filesystem image.

---

## Evidence: GitHub Build Workflow

The release workflow performs:

```text
Build Web
→ ./scripts/build_spiffs.sh

Build display FS
→ pio run -t buildfs -e display
→ cp .pio/build/display/spiffs.bin out/display-filesystem.bin
```

This proves that the web app is included in the display filesystem artifact distributed with firmware releases.

---

## Evidence: PlatformIO / SPIFFS

`platformio.ini` includes SPIFFS as a filesystem dependency for display firmware environments.

The display build produces a SPIFFS filesystem image using PlatformIO `buildfs`.

---

## Evidence: WebUIPlugin Serving Path

`src/display/plugins/WebUIPlugin.cpp` serves the web app from SPIFFS.

---

## Governance Decision

Feature development remains blocked.

Safe Sync remains blocked.

Merge-back remains blocked.

Reason:

```text
The deployment architecture is now proven at repository/build-chain level,
but target-device runtime PWA validation has not yet passed.
```
