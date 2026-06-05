# Archive Validation Plan

Status: Required Before Implementation

Archive implementation is blocked until validation completes.

---

## Purpose

Validate real-world assumptions before archive implementation begins.

Measure first.

Implement second.

Repository documentation remains authoritative.

---

## Validation Work Required

### 1. Real GaggiMate Export Structure Review

Objectives:

- Review actual export formats.
- Review profile export structure.
- Review metadata structure.
- Identify archive compatibility requirements.

Evidence Required:

- Example exports.
- Structure notes.
- Compatibility findings.

Status: Initial shot export evidence captured.

Initial shot export finding:

```text
A real active GaggiMate shot download was reviewed.

The exported shot JSON includes the same identity and analysis fields already used by the GaggiGo IndexedDB mirror:

- id
- profile
- profileId
- timestamp
- duration
- samples[]
- per-sample telemetry
- systemInfo
- phaseNumber / phaseDisplayNumber

This confirms that GaggiMate shot downloads already preserve the core factual shot data needed by GaggiGo archive storage.
```

Decision:

```text
Do not invent a separate telemetry storage model for archive MVP.

Archive records should preserve raw shot facts in the existing shot JSON shape, with archive metadata handled separately through the archive manifest.

The archive layer should organise and verify shot records; it should not transform them into a new primary data model.
```

Remaining:

```text
Profile export/import structure still needs review before implementation.
Archive manifest structure still needs validation.
```

---

### 2. Shot Identity Validation

Objectives:

Validate archive-safe shot identity.

Questions:

- Can shot numbers reset?
- Can exports from different machines collide?
- Can archive imports collide with live data?
- Is an additional fingerprint required?

Evidence Required:

- Real datasets.
- Collision analysis.
- Decision record.

Status: Substantially validated for MVP.

Initial repo findings:

```text
Current GaggiMate identity is a sequential shot ID.

index.bin entries contain:
- id (uint32)
- timestamp
- profileId

Shot payloads are loaded from:
/api/history/000123.slog

Cached mirror keys use:
gaggimate:<id>
```

Real export evidence:

```text
A real active GaggiMate shot download preserves:

- id
- profileId
- timestamp
- duration
- samples[]

This confirms the fields needed for MVP duplicate detection survive the real shot export/download boundary.
```

MVP archive duplicate identity:

```text
shotId + timestamp + profileId + sampleCount + duration
```

Reason:

```text
Provides stronger uniqueness than shotId alone while staying simple.

Captures:
- machine shot identifier
- execution time
- profile context
- recording length
- sample structure

This is sufficient for the current one-machine coffee workflow and avoids unnecessary UUIDs, machine fingerprints, lineage tracking, or archive identity registries.
```

Open validation questions:

```text
Can shot IDs reset after firmware events?
Can two machines generate the same shot IDs?
Is an additional machine identifier ever needed for multi-machine archive use?
```

Decision:

```text
Do not add archive-only UUIDs for MVP.
Do not add machine fingerprinting for MVP.
Use the existing shot facts for duplicate detection.
Use SHA256 for archive integrity verification only, not as a new primary identity system.
```

---

### 3. IndexedDB Growth Testing

Objectives:

Measure:

- Shot storage growth.
- Payload storage growth.
- Profile growth.
- Metadata growth.

Evidence Required:

- Dataset size.
- IndexedDB size.
- Growth projections.

Status: Initial measurement captured.

Initial measurement:

```text
Date: 2026-06-04
Environment: Local GaggiGo dev app, browser IndexedDB
Database: gaggimate-analyzer
Store: shots

Total cached shots: 132
GaggiMate cached shots: 132
Loaded full-payload shots: 119
Metadata-only shots: 13
Total measured JSON size: 5.76 MB
Average shot size: 44.70 KB
Largest observed shot: approx 107 KB
Smallest metadata-only shot: approx 0.35 KB
```

Decision:

```text
Initial real-world storage measurement supports the 6-month hot mirror direction.
Storage pressure is not currently the primary archive risk.
Archive remains justified for continuity, portability, backup, recovery, firmware-update safety, and browser/site-data loss protection.
```

---

### 4. Browser Storage Testing

Status: Not started.

---

### 5. Archive Size Measurement

Status: Initial projection captured. Real archive measurement pending.

---

### 6. Large Archive Import Testing

Status: Not started.

---

### 7. Runtime Validation Matrix Review

Status: Not started for archive gate.

Observed:

```text
WebSocket timeout noise while GaggiMate unavailable.
```

---

### 8. Archive Import Boundary Validation

Status: Not started.

---

## Exit Criteria

Archive implementation may begin only when all conditions are true:

- Real export structure reviewed.
- Shot identity validated.
- Storage testing completed.
- Import testing completed.
- Runtime validation review completed.
- Archive import boundary validated.

---

## Current Next Validation Target

```text
Profile export/import structure review
```

Reason:

```text
Shot export shape and MVP shot identity are now sufficiently validated for architecture purposes.
The next remaining export-boundary risk is profile export/import shape and restore-as-copy behaviour.
```

---

## Final Rule

Validation before implementation.

Documentation before implementation.

Measure before redesign.

Avoid architecture drift.
