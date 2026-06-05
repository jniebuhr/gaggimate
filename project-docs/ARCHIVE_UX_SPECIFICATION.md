# ARCHIVE_UX_SPECIFICATION.md

## Status

Version: Draft 1.0

Status: UX Design Phase

Authority Level: Archive UX Authority

## Purpose

This document defines the user experience requirements for the GaggiGo archive system.

The archive engine implementation is already complete.

This document defines how users interact with that engine.

## Design Principles

- Simple by default
- Detailed when requested
- Action first
- Information second
- Human language over technical language
- User controlled
- No surprise automation
- Warnings inform
- Critical failures block
- Success disappears
- Problems remain visible

## User Terminology

Backend terminology remains Archive/Import/Export.

User-facing terminology becomes:

- Backup
- Restore
- Backup Ready
- Backup Restored

## Navigation

Archive functionality is accessed through:

Storage

## Storage Page

Purpose text:

Protect your coffee history and profiles by creating backups you can restore later.

Primary actions:

- Create Backup
- Restore Backup

Equal size and equal prominence.

## Layout Rules

Storage

Purpose Text

Create Backup

Restore Backup

Archive Information

Action first. Information second.

## First-Time User Experience

Show only purpose text and backup actions.

Do not show archive health, metadata or statistics.

## Returning User Experience

Show Last Backup Activity.

Additional archive information remains behind details expansion.

## Create Backup Flow

Create Backup -> Review Backup -> Create Backup -> Backup Ready -> Download Backup

Review Backup default view:

- Shots
- Profiles
- Estimated Size

Details view:

- Notes
- Tags
- Archive Period
- Archive Health

No automatic download.

## Restore Backup Flow

Restore Backup -> Choose Backup File -> Processing -> Backup Restored

Hide engine implementation details unless intervention is required.

## Restore Results

Always show:

- Imported count
- Duplicate count
- Warning count when present

## Warning Behaviour

Warnings do not block restore.

## Critical Failure Behaviour

Critical failures block restore.

## Profile Conflict Handling

Options:

- Keep Current
- Restore Backup
- Keep Both

No default selection.

Single conflict review screen.

Keep Both naming:

Profile Name (YYYY-MM-DD)

Date source: Profile Creation Date.

Avoid Copy, Copy 2, Copy 3.

## Information Hierarchy

Simple by default.

Detailed when requested.

Advanced information should remain behind Show Details style controls.
