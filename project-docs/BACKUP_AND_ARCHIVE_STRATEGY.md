# Backup and Archive Strategy

## Purpose

Define the storage, archive, backup, and restore direction before any archive, backup, restore, or sync implementation begins.

This document exists to prevent drift.

No coding should begin on backup/archive/restore until this model has been reviewed, validated, and accepted.

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

Implementation principle:

```text
Automatic protection.
Explicit commitment.
```

Meaning:

```text
Automatic hydration = yes
Automatic integrity verification = yes
Automatic archive creation = no
Automatic destructive storage behaviour = no
Automatic reverse restore to GaggiMate = no
```

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
GaggiGo is a read-only mirror/archive for shot facts.
User metadata remains editable where explicitly supported.
```

### Restore Mode

```text
GaggiGo may push selected safe data back to GaggiMate only as an explicit user action.
```

Restore direction is intentionally narrow.

Profiles may be restored back to GaggiMate only when the user explicitly chooses to restore a selected profile.

Historical shots/history remain GaggiGo continuity/archive data.

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

## Archive Contents

Archive bundles should contain:

```text
shot data
shot metadata
notes
ratings
tags
user annotations
embedded profile snapshots
safe machine/version metadata
manifest
integrity data
```

Archive bundles must not rely on live GaggiMate state existing later.

A restored or opened archive should still make sense even if:

```text
the original profile was edited
the original profile was deleted
GaggiMate storage was wiped
firmware changed
profile IDs changed
```

Archive facts.

Recompute insights.

Do not store:

```text
analyzer outputs
statistics outputs
derived caches
computed snapshots
generated videos
```

Generated videos are export artefacts only.

Raw shot data remains the replay source.

---

## Historical Immutability Model

Immutable archive data:

```text
shot telemetry
shot samples
shot timestamps
embedded profile snapshot
historical machine context
```

Editable archive data:

```text
notes
ratings
tags
user annotations
```

Principle:

```text
Facts are historical.
Interpretation can evolve.
```

---

## Existing GaggiMate Export / Import Compatibility

Original GaggiMate already supports profile export/import.

GaggiGo must not invent an incompatible profile backup format without reason.

Known model from current profile tooling:

```text
single profile export
all profiles export as profiles.json
profile import from JSON/TCL
import saves profiles back through safe profile save requests
```

Profile export currently strips runtime machine/list state such as:

```text
id
selected
favorite
```

GaggiGo archive design must remain compatible with that profile shape where practical.

Compatibility rule:

```text
Profiles inside a GaggiGo archive should be GaggiMate-compatible profile JSON.
The archive bundle itself may be GaggiGo-specific.
```

This means:

```text
Profile file
= GaggiMate-compatible profile JSON

Archive metadata
= GaggiGo-specific historical context
```

Example archive layout:

```text
2026-H1.gaggigo.zip
│
├── manifest.json
├── shots/
│   ├── shot-001.json
│   └── shot-002.json
│
├── profiles/
│   ├── profile-espresso.json
│   └── profile-decaf.json
│
├── notes/
│   └── notes.json
│
├── metadata/
│   ├── profile-map.json
│   ├── shot-map.json
│   └── integrity.json
```

Profile map metadata can preserve archive-only context such as:

```json
{
  "archiveProfileId": "profile_2026_H1_espresso",
  "originalGaggiMateId": 4,
  "label": "House Espresso",
  "usedByShots": ["shot_001", "shot_002"]
}
```

Do not automatically reuse existing profile import behaviour for archive restore.

Existing import flow writes profiles back to GaggiMate profile storage.

That is a machine-state write and must remain explicit.

Archive import should:

```text
merge archive data into GaggiGo history/archive first
preserve profile snapshots as historical context
avoid writing to GaggiMate automatically
```

Only an explicit user action such as:

```text
Restore this profile to GaggiMate
```

may call the safe profile save path.

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
→ local GaggiGo mirror and local archive copies can be lost

Different laptop / phone / tablet
→ hydrate from GaggiMate current rolling dataset
→ optionally import exported archive backup for older history

GaggiMate with SD card
→ improves machine-side retention
→ GaggiGo still mirrors and archives safe data
```

Important rule:

```text
Local PWA storage is not a backup.
Exported archives are backups.
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
default 6-month hot mirror
fast analyzer/statistics access
```

Default hot retention:

```text
current month + previous 5 months
```

This is the MVP default, not a permanent architectural limit.

Later settings may support:

```text
1 month
3 months
6 months
12 months
unlimited
```

### Tier 3 — GaggiGo Cold Archive

```text
6-month archive bundles
slower than hot mirror
still searchable/viewable/openable through GaggiGo
```

Cold archives should keep historical data without indefinite IndexedDB hot-mirror growth.

### Tier 4 — Backup Export

```text
portable disaster recovery bundle
single-click export
user-owned
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

## Hot Mirror Ceiling

Time alone is not enough.

A user making one coffee per day and a user making ten coffees per day produce very different storage pressure.

Hot mirror limits should eventually be based on:

```text
shot count
storage size
```

Whichever limit is reached first should trigger an archive/export recommendation.

The actual limits are not yet defined.

They require measurement of:

```text
average shot payload size
average hydrated shot size
average profile snapshot size
average note/metadata size
IndexedDB growth rate
```

Do not invent hard caps before measurement.

---

## Archive Units

Default archive unit:

```text
6-month archive bundle
```

Examples:

```text
2026-H1.gaggigo.zip
2026-H2.gaggigo.zip
```

Default packaging:

```text
one archive bundle per half-year
```

Exception:

```text
archive size
browser stability
import/export performance
storage reliability
```

If measured problems appear, half-year bundles may be split into parts.

Example:

```text
2026-H1-part1.gaggigo.zip
2026-H1-part2.gaggigo.zip
```

Rule:

```text
Prefer the simplest architecture.
Only introduce complexity when measurements justify it.
```

---

## Archive Format

Archive bundles should be:

```text
human-readable
portable
versioned
self-describing
recoverable without GaggiGo where practical
```

Preferred structure:

```text
ZIP-compatible archive
JSON contents
documented schema
manifest
SHA256 integrity data
```

Data should outlive software.

---

## Manifest Requirement

Every archive bundle must contain a manifest.

Manifest should include:

```text
archive version
schema version
bundle type
bundle period
creation date
shot count
profile snapshot count
metadata count
originating GaggiGo version
source information
storage metrics
archive summaries
SHA256 checksum information
```

The manifest contains only fields required by the current schema.

Do not create:

```text
reserved fields
placeholder fields
future schema sections
```

Future requirements are introduced through schema version updates.

Reason:

```text
Data without context becomes archaeology.
Data with a manifest remains usable.
```

---

## Integrity Verification

Integrity verification is mandatory and automatic.

Integrity algorithm:

```text
SHA256 only
```

Rules:

```text
No alternative checksum algorithms.
No user-selectable checksum algorithms.
No fallback algorithms.
Future algorithm changes require a schema version update.
```

Archive creation flow:

```text
create archive
generate SHA256 checksums
store integrity data in manifest
verify archive integrity
mark archive as valid
allow export
```

Import flow:

```text
read archive
read manifest first
verify SHA256 checksums
validate manifest
validate schema version
import if valid
```

If verification fails:

```text
Archive Health = Critical
Reason = archive integrity check failed
Action = do not import damaged records; use another backup if available
```

Users should see:

```text
Archive verified
```

or:

```text
Archive corrupted
```

They should not need to understand checksum internals.

---

## Archive Creation and Migration

Archive creation is user controlled.

GaggiGo may recommend archive creation.

GaggiGo must not automatically create archives.

When the hot mirror threshold is reached, GaggiGo should prompt the user rather than automatically archiving.

Reason:

```text
A device may be primary, secondary, temporary, or shared.
The app should not assume every device should hold or create archives.
```

Storage pressure behaviour:

```text
display warning
explain reason
recommend action
offer archive/export workflow
```

The system must guide the user, not silently mutate storage.

---

## Cleanup Rules

GaggiGo may recommend cleanup.

GaggiGo must not perform cleanup automatically.

Data may only be removed when all conditions are true:

1. Archive exists.
2. Archive integrity is verified.
3. User confirms cleanup.
4. Records being removed exist inside the verified archive.

Cleanup must remove only records contained in the verified archive.

Do not delete records merely because they are older than the hot mirror window.

---

## Archive Access Behaviour

History should show hot mirror and archive data together.

Storage tier should not split the user's workflow.

Expected behaviour:

```text
searchable
browsable
openable
analyzable
```

UI rule:

```text
Do not split History into separate worlds.
Use small storage-tier indicators only.
```

Example indicators:

```text
Hot Mirror
Archive
```

Accepted tradeoff:

```text
archive access may be slower than hot mirror access
```

Users tolerate archive latency if recent data remains fast.

---

## Restore Behaviour

Default restore model:

```text
merge only
non-destructive
additive
```

Do not replace existing history.

Do not silently push restored data to GaggiMate.

Do not automatically merge entire archives into hot IndexedDB unless explicitly requested.

Current intended restore scope:

```text
Profiles
→ may restore selected profile back to GaggiMate only by explicit user action

Historical shots/history
→ remain GaggiGo continuity/archive data

Notes / ratings / tags
→ remain editable after restore
```

Restore to GaggiMate must remain an explicit safe action.

---

## Archive Import Behaviour

Archive import is separate from profile import.

Archive import must be manifest-first.

Archive import flow:

```text
select .gaggigo.zip
read manifest.json
validate manifest
validate schema
validate SHA256 integrity information
show summary
import only if validation allows it
```

Duplicate records are skipped and reported.

Import results must report:

```text
records imported
records skipped
reason for skipped records
warnings
health status
recommended action
```

Example:

```text
Imported: 114
Skipped: 18
Reason: Duplicate records
Health: Good
```

Partial recovery is allowed.

If part of an archive is damaged but other sections validate, GaggiGo may import valid data, skip invalid data, and report a warning.

The import should not fail completely because one non-critical record is damaged.

Backwards-compatible imports are allowed.

Older supported schema versions should import with a warning and a re-export recommendation.

Unsupported or unsafe schema versions may be blocked.

---

## Archive Health Model

Archive health uses clear status states:

```text
Good
Warning
Critical
```

Each state must include:

```text
status
reason
recommended action
```

Health is calculated during validation/import.

Health is not permanently stored as a fixed archive fact.

Reason:

```text
Archive health depends on current environment, current schema support, current compatibility rules, and current validation results.
```

Good example:

```text
Warning
Reason: Archive uses an older supported schema.
Action: Import is supported. Re-export using the latest version when convenient.
```

Bad example:

```text
Warning
```

Health status should be informative and actionable.

It should not nag, block, or force routine actions unless data is genuinely at risk.

---

## Archive Storage and Export

GaggiGo may keep local archive copies so older history remains browsable.

However:

```text
Local Archive = convenience
Exported Archive = backup
```

Local PWA storage can be lost if:

```text
browser cache/site data is cleared
browser profile is corrupted
device is reset
user changes device
```

GaggiGo must communicate this clearly.

Archive export should be:

```text
single-click
portable
user-owned
verified automatically
```

Exportable destinations later may include:

```text
Downloads
NAS
external storage
cloud storage chosen by the user
backup systems
```

Exportable does not mean automatically uploaded.

GaggiGo may help export archives.

GaggiGo does not take ownership of them.

---

## Firmware Update Safety Flow

Before risky firmware/update actions, GaggiGo should eventually show a protection prompt.

```text
Firmware update detected or user enters update flow
↓
GaggiGo checks mirror freshness, archive health, and last export status
↓
Prompt:
"Backup recommended before update."
↓
[Export Backup] [Skip]
```

Backup must be easy and explicit.

GaggiGo should not silently upload, externally export, or automatically archive data without user consent.

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
import exported archive backup
```

This preserves the current PWA-style behaviour while adding long-term continuity.

---

## Do Not Build Yet

Before implementation, validate:

```text
real GaggiMate export structure
real shot payload sizes
real IndexedDB growth rate
browser quota behaviour
archive schema/version manifest
shot identity algorithm
large archive import behaviour
archive import boundary against existing profile import behaviour
runtime validation matrix
```

See:

```text
project-docs/ARCHIVE_VALIDATION_PLAN.md
```

---

## Final Principle

Simple by default.

Deterministic by design.

Archive facts.

Recompute insights.

Protect data.

Avoid complexity.
