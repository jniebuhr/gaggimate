# GaggiGo Archive Architecture Specification

Version: Draft 1.0
Status: Approved For Pre-Implementation Review

## Purpose

This document defines the archive, backup, retention, import, and restore architecture for GaggiGo.

Implementation must follow this document.

## System Identity

### GaggiMate

- Source authority
- Runtime owner
- Telemetry source
- Rolling operational datastore

### GaggiGo

- Offline-first observer
- IndexedDB mirror
- Historical archive
- Analyzer workspace
- Statistics workspace
- Future safe sync client

## Authority Model

Connected:

GaggiMate is authoritative.

Offline:

GaggiGo is a historical mirror.

Restore:

Explicit only. Never automatic.

## Storage Architecture

Single persistence authority:

LibraryService -> IndexedDBService -> IndexedDB

No parallel persistence systems.

## Settings Model

Settings are context only.

Settings are not authority, backup, or sync inputs.

Only filtered safe snapshots may be cached and shown offline.

## Core Archive Principle

Archive facts.

Recompute insights.

Store shots, profiles, metadata, notes, ratings, tags, and annotations.

Do not store analyzer results, statistics results, derived caches, or computed snapshots.

## Retention Model

Tier 1: ESP32 rolling store.

Tier 2: GaggiGo hot mirror.

- Default 6 months
- Current month plus previous 5 months

Tier 3: six-month archive bundles.

- Example: 2026-H1.gaggigo.zip
- Example: 2026-H2.gaggigo.zip

Tier 4: exported backups.

## Archive Contents

- Shot data
- Shot metadata
- Notes
- Ratings
- Tags
- User annotations
- Embedded profile snapshots
- Safe machine metadata
- Version metadata
- Manifest
- Integrity information

## Profile Preservation Rule

Archive all profiles exactly as exported.

Includes:

- Brew profiles
- Utility profiles
- Default profiles
- Inactive profiles
- Experimental profiles

Store everything.
Filter later.
Never discard during archive.

## Existing GaggiMate Compatibility

Profiles stored inside archives should remain compatible with existing GaggiMate profile exports.

Use GaggiMate-compatible profile JSON plus GaggiGo archive metadata.

## Archive Bundle Structure

Example:

- 2026-H1.gaggigo.zip
- manifest.json
- shots/
- profiles/
- notes/
- metadata/

Archive bundles should be human readable, portable, versioned, and self-describing.

## Manifest Requirements

- Archive version
- Schema version
- Bundle type
- Bundle period
- Creation date
- Shot count
- Profile count
- Metadata count
- GaggiGo version
- Source information
- Storage metrics
- Archive summaries
- Integrity information

## Manifest Scope Rule

The manifest contains only fields required by the current schema.

Do not create:

- Reserved fields
- Placeholder fields
- Future schema sections

Future requirements are introduced through schema version updates.

## Integrity Model

Mandatory and automatic.

Integrity algorithm:

```text
SHA256 only
```

Rules:

- No alternative checksum algorithms
- No user-selectable checksum algorithms
- No fallback algorithms
- Future algorithm changes require a schema version update

Archive creation:

- Generate manifest
- Generate SHA256 checksums
- Store section integrity information

Archive import:

- Read manifest first
- Validate manifest
- Validate schema
- Validate SHA256 checksums
- Continue only if validation rules allow it

Integrity should include:

- Overall archive checksum
- Section checksums
- Shot data checksum
- Profile data checksum
- Notes / metadata checksum where present

## Archive Health Model

Health states:

- Good
- Warning
- Critical

Every health status must include:

- Reason
- Recommended action

Health is calculated at import or validation time, not permanently fixed at archive creation time.

Reason:

Archive health depends on current environment, current schema support, current compatibility rules, and current validation results.

Archive creation records the data needed to validate health later.

Archive import calculates the current health outcome.

Health status must never be vague.

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

## Local Archive vs Backup

Local Archive != Backup.

Exported Archive = Backup.

## Export Model

Single-click export.

System handles archive build, verification, manifest creation, and download.

## Restore Model

Merge only.

Never replace existing data.

## Archive Import Boundary Rule

Archive functionality must not be mixed into the existing GaggiMate profile import workflow.

Existing profile import remains unchanged:

- .json / .tcl
- parseProfile()
- save profile through the existing profile save request
- GaggiMate profile storage

Purpose:

- Profile restore
- Profile migration
- Profile sharing

Archive import is a separate workflow:

- .gaggigo.zip
- Archive Import
- Manifest Validation
- Integrity Verification
- Duplicate Detection
- IndexedDB Merge
- GaggiGo Archive/History

Purpose:

- Historical restoration
- Archive rehydration
- Device migration
- Backup recovery

Authority separation:

Profile Import may write to GaggiMate.

Archive Import must not automatically write to GaggiMate.

Archive imports restore GaggiGo data only.

Do not extend the existing profile import control to handle archives.

Do not add .gaggigo.zip to the existing profile import input.

Archive Import, Archive Export, and Archive Health must be separate archive functionality.

Profile restoration from an archive is allowed only as an explicit user action:

- User selects archived profile
- Restore as copy
- Explicit confirmation
- Save through the existing profile save request

Restored archive profiles must be created as copies.

Example:

House Espresso -> House Espresso (Restored)

This preserves:

- Clear authority boundaries
- Existing master compatibility
- Merge-back compatibility
- Safety
- User expectations

and prevents:

- Archive import unexpectedly modifying live state
- Archive import overwriting active profiles
- Archive import becoming a full restore operation

## Import Behaviour

Archive import must be manifest-first.

Import flow:

- Select archive
- Read manifest.json
- Validate manifest
- Validate schema
- Validate integrity information
- Show summary
- Import only if validation allows it

Duplicate records are skipped.

Import results must report:

- Records imported
- Records skipped
- Reason for skipped records
- Any warnings

Example:

```text
Imported: 114
Skipped: 18
Reason: Duplicate records
```

Partial recovery is allowed.

If part of an archive is damaged but other sections validate, GaggiGo may import valid data, skip invalid data, and report a warning.

The import should not fail completely because one non-critical record is damaged.

Backwards-compatible imports are allowed.

Older supported schema versions should import with a warning and a re-export recommendation.

Unsupported or unsafe schema versions may be blocked.

## Storage Pressure Behaviour

When storage usage exceeds recommended limits:

- Display warning
- Explain reason
- Recommend action
- Offer archive/export workflow

The system should guide the user to archive or export data.

The system must not automatically archive data.

## Archive Creation Behaviour

Archive creation is user controlled.

GaggiGo may recommend archive creation.

GaggiGo must not automatically create archives.

When the hot mirror threshold is reached, GaggiGo should prompt the user rather than automatically archiving.

Reason:

A device may be primary, secondary, temporary, or shared. The app should not assume that every device should hold or create archives.

## Cleanup Rules

GaggiGo may recommend cleanup.

GaggiGo must not perform cleanup automatically.

Data may only be removed when all conditions are true:

1. Archive exists
2. Archive integrity is verified
3. User confirms cleanup
4. Records being removed exist within the verified archive

Cleanup must remove only records contained in the verified archive.

Do not delete records merely because they are older than the hot mirror window.

## Editability Model

Immutable:

- Shot telemetry
- Timestamps
- Profile snapshots
- Machine context

Editable:

- Notes
- Ratings
- Tags
- Annotations

Facts are historical. Interpretation can evolve.

## Duplicate Detection

Archive import must be idempotent.

Duplicate records are skipped and reported.

Provisional archive identity:

```text
shotDateTime + shotNumber
```

This must be validated against real GaggiMate exports before implementation.

Future schema versions may add a derived fingerprint if real-world testing proves it is needed.

## Schema Compatibility Rule

Archive readers support older archive versions where practical.

Archive writers only create current archive versions.

No reserved future fields should be added to v1 manifests.

Future features should be introduced through schema version updates.

## Single Archive Authority Rule

One archive format.
One archive location.
One archive index.

No parallel archive systems.

## Multi Device Model

Each device hydrates from the same GaggiMate authority.

Older history may be restored from archive imports.

Archive import rehydrates GaggiGo, not GaggiMate.

## User Experience Principle

Simple by default.
Detailed when requested.

Casual users should not be overwhelmed.

Advanced users should have access to detailed archive information when required.

The target audience includes both enthusiast users and household users.

## Transparency Principle

Simple internally.
Transparent externally.

Users should be informed of:

- Import results
- Duplicate handling
- Integrity results
- Health status
- Recommended actions
- Cleanup consequences

Avoid unexplained success messages.

Prefer clear summaries such as:

```text
Imported: 114
Skipped: 18 duplicates
Health: Good
```

## MVP Scope Classification

### Must Have

- Export archive
- Import archive
- .gaggigo.zip archive format
- manifest.json
- SHA256 integrity verification
- Archive version
- Schema version
- Source metadata
- Archive summaries
- Duplicate detection
- Duplicate skipping
- Duplicate reporting
- Merge-only import
- Partial recovery
- Backwards-compatible imports where safe
- Archive import boundary
- Separate profile import path
- Restore-as-copy profiles
- 6-month hot mirror
- 6-month archive bundles
- Optional cleanup
- Cleanup only after verified archive
- Cleanup only for archived records
- Manifest-first validation
- Health status with reason and action

### Should Have

- Storage pressure warnings
- Archive size metrics
- Estimated restore size
- Archive creation guidance
- Archive review screen
- Archive health display
- Archive compatibility warnings
- Re-export recommendations
- Import summary screen

### Future

Do not build for archive MVP:

- Archive history database
- Archive lineage tracking
- Archive relationship graphs
- Advanced diagnostics centre
- Archive analytics
- Storage trend graphs
- Recommendation engine
- Automatic archive scheduling
- Automatic cleanup
- Multi-archive dependency systems
- Cloud archive support
- Cross-device archive orchestration

## Pre-Implementation Requirements

- Measure real shot payload sizes with larger real-life datasets
- Measure IndexedDB growth
- Measure archive sizes
- Measure browser storage behaviour
- Define and validate shot identity algorithm
- Define final archive manifest schema
- Validate archive import boundary against existing profile import behaviour
- Test large archive import behaviour
- Complete runtime validation matrix review

## Final Principle

Simple by default.
Deterministic by design.
Archive facts.
Recompute insights.
Protect data.
Avoid complexity.
