# GaggiGo Archive Architecture Specification

Version: Draft 1.0
Status: Approved For Pre-Implementation Review

## Purpose

This document defines the archive, backup, retention, and restore architecture for GaggiGo.

Implementation must follow this document.

## System Identity

### GaggiMate
- Source Authority
- Machine Controller
- Runtime Owner
- Telemetry Source
- Rolling Operational Datastore

### GaggiGo
- Offline-First Observer
- IndexedDB Mirror
- Historical Archive
- Analyzer Workspace
- Statistics Workspace
- Future Safe Sync Client

## Non-Negotiable Rule

GaggiMate controls the machine.

GaggiGo observes, stores, analyses, archives, and later syncs safe data.

Never introduce machine controls, brew controls, grinder controls, scale controls, PID control, autotune, OTA, Bluetooth management, raw websocket administration, or unrestricted settings writes.

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

Store shots, profiles, metadata, notes, ratings, tags and annotations.

Do not store analyzer results, statistics results, derived caches, or computed snapshots.

## Retention Model

Tier 1: ESP32 Rolling Store

Tier 2: GaggiGo Hot Mirror
- Default 6 months
- Current month plus previous 5 months

Tier 3: Quarterly Archives
- Example: 2026-Q1.gaggigo.zip

Tier 4: Exported Backups

## Archive Contents

- Shot data
- Shot metadata
- Notes
- Ratings
- Tags
- User annotations
- Embedded profile snapshots
- Machine metadata
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

2026-Q2.gaggigo.zip
- manifest.json
- shots/
- profiles/
- notes/
- metadata/

Human readable, portable, versioned, self-describing.

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

Local Archive != Backup

Exported Archive = Backup

## Export Model

Single-click export.

System handles build, verification, manifest creation and download.

## Restore Model

Merge only.

Never replace existing data.

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

## Final Principle

Simple by default.
Deterministic by design.
Archive facts.
Recompute insights.
Protect data.
Avoid complexity.
