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

Validate provisional identity:

```text
shotDateTime + shotNumber
```

Questions:

- Can shot numbers reset?
- Can exports from different machines collide?
- Can archive imports collide with live data?
- Is an additional fingerprint required?

Evidence Required:

- Real datasets.
- Collision analysis.
- Decision record.

Status: Not started.

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

Projected uncompressed JSON size:
100 shots: 4.36 MB
300 shots: 13.09 MB
600 shots: 26.19 MB
1000 shots: approx 43.65 MB
2000 shots: approx 87.30 MB
```

Decision:

```text
Initial real-world storage measurement supports the 6-month hot mirror direction.
Storage pressure is not currently the primary archive risk.
Archive remains justified for continuity, portability, backup, recovery, firmware-update safety, and browser/site-data loss protection.
Further measurement is still required with larger datasets and browser quota checks before implementation.
```

---

### 4. Browser Storage Testing

Objectives:

Measure:

- Chrome behaviour.
- Edge behaviour.
- Quota behaviour.
- Storage pressure behaviour.

Evidence Required:

- Browser version.
- Dataset size.
- Observed limits.

Status: Not started.

---

### 5. Archive Size Measurement

Objectives:

Measure:

- Small archive.
- Medium archive.
- Large archive.

Evidence Required:

- Shot counts.
- Archive size.
- Compression ratios.

Status: Initial uncompressed projection captured from IndexedDB measurement. Real archive bundle and compression measurement still required.

---

### 6. Large Archive Import Testing

Objectives:

Measure:

- Import duration.
- Memory behaviour.
- Duplicate detection behaviour.
- Partial recovery behaviour.

Evidence Required:

- Dataset size.
- Results.
- Risks.

Status: Not started.

---

### 7. Runtime Validation Matrix Review

Objectives:

Verify current MVP behaviour remains stable.

Areas:

- Profiles.
- History.
- Analyzer.
- Statistics.
- Offline behaviour.
- Hydration behaviour.
- Duplicate prevention.

Evidence Required:

- Validation results.
- Issues found.
- Decisions.

Status: Not started for archive gate.

Observed during measurement:

```text
Repeated WebSocket timeout noise was present while GaggiMate was unavailable:
ws://192.168.0.129/ws
ERR_CONNECTION_TIMED_OUT
ApiService.js:82
```

Decision:

```text
This does not block archive measurement, but should remain tracked as runtime noise during validation.
```

---

### 8. Archive Import Boundary Validation

Objectives:

Verify archive import remains separate from profile import.

Validate:

- Existing profile import unchanged.
- Archive import rehydrates GaggiGo only.
- No automatic GaggiMate writes.
- Restore-as-copy profile workflow.

Evidence Required:

- Test results.
- Boundary confirmation.

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

## Required Record Format

Each validation task should capture:

```text
Objective
Method
Dataset
Results
Risks
Decision
```

---

## Current Next Validation Target

```text
Shot identity validation
```

Reason:

```text
Initial storage measurement suggests archive size is manageable.
The next architectural risk is deterministic shot identity across resets, exports, imports, and possible multi-device use.
```

---

## Final Rule

Validation before implementation.

Documentation before implementation.

Measure before redesign.

Avoid architecture drift.
