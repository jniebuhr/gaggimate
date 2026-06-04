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

## Final Rule

Validation before implementation.

Documentation before implementation.

Measure before redesign.

Avoid architecture drift.
