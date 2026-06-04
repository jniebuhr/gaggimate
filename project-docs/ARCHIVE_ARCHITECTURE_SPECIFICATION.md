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
- Integrity information

## Integrity Model

Mandatory and automatic.

Create archive -> checksum -> verify -> valid.

Import archive -> verify -> validate manifest -> validate schema -> import.

## Archive Health Model

- Good
- Warning
- Critical

Each status must provide explanation and recommended action.

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

Duplicate records are skipped silently.

## Schema Compatibility Rule

Archive readers support older archive versions.

Archive writers only create current archive versions.

## Single Archive Authority Rule

One archive format.
One archive location.
One archive index.

No parallel archive systems.

## Multi Device Model

Each device hydrates from the same GaggiMate authority.

Older history may be restored from archive imports.

## Pre-Implementation Requirements

- Measure real shot payload sizes
- Measure IndexedDB growth
- Measure archive sizes
- Measure browser storage behaviour
- Define shot identity algorithm
- Define archive manifest schema
- Validate archive import boundary against existing profile import behaviour

## Final Principle

Simple by default.
Deterministic by design.
Archive facts.
Recompute insights.
Protect data.
Avoid complexity.
