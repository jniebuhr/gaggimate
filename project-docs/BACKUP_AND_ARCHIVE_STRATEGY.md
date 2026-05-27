# Backup and Archive Strategy

## Purpose

Define the next storage phase before any backup, archive, restore, or sync implementation begins.

This document exists to prevent drift.

No coding should begin on backup/archive/restore until this model has been reviewed and accepted.

---

## Core Principle

```text
GaggiMate owns live machine state.
GaggiGo owns historical continuity.
```

GaggiMate remains the live authority.

GaggiGo becomes the persistent mirror, archive, analysis, and recovery layer.

Hydration is the sync model.

This is not cloud sync.

This is not hidden two-way sync.

This is not automatic reverse control of GaggiMate.

---

## System Roles

### GaggiMate / ESP32

```text
live machine authority
runtime owner
central live datastore
rolling operational storage
source of profiles, shots, history, tags, metadata, and safe persistent data
```

The ESP32 may have limited storage. If storage fills, the machine may rotate/delete the oldest shots from the ESP32.

That ESP32 deletion must not delete already mirrored GaggiGo archive data.

### GaggiGo

```text
local mirror node
historical archive
analysis/statistics workspace
firmware-update continuity helper
backup/restore assistant later
```

Every GaggiGo client hydrates from GaggiMate when connected.

Phone, PC, tablet, and other clients can each build their own local mirror from the same GaggiMate source.

---

## Authority Model

### Connected

```text
GaggiMate is authoritative.
GaggiGo hydrates from GaggiMate.
```

### Offline

```text
GaggiGo is a read-only mirror/archive.
```

### Restore mode

```text
GaggiGo may push selected safe data back to GaggiMate only as an explicit user action.
```

GaggiGo must never silently overwrite GaggiMate.

GaggiMate must never silently erase GaggiGo archived history.

---

## What Gets Mirrored

GaggiGo should mirror all safe persistent data from the ESP32.

Included:

```text
profiles
shot metadata
full shot payloads
tags
notes
ratings
history indexes
analyzer-ready data
statistics-ready data
filtered settings snapshot
machine/version metadata
firmware/version metadata
```

Excluded:

```text
live brew state
machine controls
raw websocket admin
OTA
PID/autotune
Bluetooth management
unsafe settings writes
secrets/raw credentials
temporary runtime values
```

Settings exception:

```text
GaggiMate = settings authority
GaggiGo = filtered cached read-only snapshot
```

Settings must remain bounded by the existing settings safety model.

---

## Existing GaggiMate Export / Import Behaviour

Original GaggiMate already supports profile export/import.

GaggiGo must not invent an incompatible profile backup format without reason.

Profile backup/restore should remain compatible with GaggiMate profile export/import where practical.

Known model from original GaggiMate:

```text
single profile export
all profiles export as profiles.json
profile import from JSON/TCL
import saves profiles back through safe profile save requests
```

GaggiGo can add its own broader mirror/archive package later, but profile handling should respect the existing GaggiMate-compatible format.

---

## Persistence Survival Matrix

```text
Browser refresh
→ survives

Browser close / reopen
→ survives

Offline use
→ survives

GaggiMate firmware update
→ survives in GaggiGo mirror if hydrated first

GaggiMate storage wipe
→ survives in GaggiGo mirror if hydrated first

ESP32 storage full / oldest shot rotated out
→ GaggiGo preserves already mirrored shot

Browser site data cleared
→ local GaggiGo mirror is lost on that browser

Different laptop / phone / tablet
→ hydrate from GaggiMate current rolling dataset
→ optionally import archive backup for older history

GaggiMate with SD card
→ improves machine-side retention
→ GaggiGo still mirrors and archives safe data
```

---

## Retention Model

The system uses tiered retention.

### Tier 1 — ESP32 Rolling Store

```text
live operational datastore
limited storage
oldest shots may rotate out when full
```

### Tier 2 — GaggiGo Hot Mirror

```text
IndexedDB fast working set
rolling 3-month hot mirror
fast analyzer/statistics access
```

Default hot retention:

```text
current month + previous 2 months
```

### Tier 3 — GaggiGo Cold Archive

```text
monthly sealed archive bundles
slower than hot mirror
still searchable/viewable/openable through GaggiGo
```

Cold archives should keep historical data without indefinite IndexedDB growth.

### Tier 4 — Backup Export

```text
portable disaster recovery bundle
manual/user-confirmed
no cloud required
```

Used for:

```text
browser/site-data risk
new device restore
firmware update safety
long-term off-device backup
```

---

## Archive Units

Default archive unit:

```text
monthly archive
```

Example:

```text
2026-01.gaggigo
2026-02.gaggigo
2026-03.gaggigo
```

Optional later optimisation:

```text
six-month consolidation
```

Consolidation should only be suggested when file sizes become large enough to justify it.

Do not make consolidation mandatory early.

---

## Archive Trigger

Do not silently consume storage.

Do not rely only on manual discipline.

Preferred model:

```text
GaggiGo suggests archive creation automatically.
User confirms.
```

Examples:

```text
month-end archive prompt
firmware-update backup prompt
storage pressure warning
large hot mirror warning
```

---

## Firmware Update Safety Flow

Before risky firmware/update actions, GaggiGo should eventually show a protection prompt.

```text
Firmware update detected or user enters update flow
↓
GaggiGo checks mirror freshness, unsaved archive state, and last backup timestamp
↓
Prompt:
"Backup recommended before update."
↓
[Backup Now] [Skip]
```

Backup must be easy and explicit.

GaggiGo should not silently create large backups without user consent.

---

## Archive Access Behaviour

Cold archive data should remain accessible inside GaggiGo.

Expected behaviour:

```text
searchable
browsable
openable
analyzable
```

Accepted tradeoff:

```text
cold archive access may be slower than hot mirror access
```

Users tolerate archive latency if recent data remains fast.

---

## Restore Behaviour

Default restore model:

```text
view/search from archive first
promote selected shots back into hot mirror only when needed
```

Do not automatically merge entire archives into hot IndexedDB unless explicitly requested.

Do not silently push restored data to GaggiMate.

Restore to GaggiMate must be an explicit safe action.

---

## Critical Retention Rule

```text
ESP32 rotation deletion never deletes archived GaggiGo history.
```

Hydration is additive.

```text
If a shot exists on ESP32
→ mirror or update it locally

If a shot disappears from ESP32 later
→ preserve already mirrored local/archive copy
```

---

## Multi-Device Model

No cloud is required.

Each device hydrates from GaggiMate.

```text
Phone
PC
Tablet
↓
connect to same GaggiMate
↓
hydrate current rolling dataset
```

For older data no longer on ESP32:

```text
import archive backup
```

This preserves the current PWA-style behaviour while adding long-term continuity.

---

## Do Not Build Yet

Before implementation, brainstorm and validate:

```text
archive file format
compression method
schema/version manifest
hot/cold query model
archive index strategy
restore UX
firmware update prompt UX
storage pressure warnings
safe profile compatibility
```

No implementation until this is reviewed.
