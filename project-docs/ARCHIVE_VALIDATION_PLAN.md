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

Status: Not started.

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

Status: In progress.

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

Provisional archive identity decision:

```text
shotId + timestamp + profileId + sampleCount + duration
```

Reason:

```text
Provides substantially stronger uniqueness than shotId alone.

Captures:
- machine shot identifier
- execution time
- profile context
- recording length
- sample structure

Simple enough for MVP.

Must still be validated against real exports before implementation.
```

Open validation questions:

```text
Can shot IDs reset after firmware events?
Can two machines generate the same shot IDs?
Does export/import preserve all identity fields?
Is an additional machine identifier required?
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
Real GaggiMate export structure review
```

Reason:

```text
Archive identity now has a provisional decision.
The next step is verifying that export data preserves the required identity fields.
```

---

## Final Rule

Validation before implementation.

Documentation before implementation.

Measure before redesign.

Avoid architecture drift.
