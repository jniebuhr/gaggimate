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

Show only backup activities that have occurred.

Default archive information may include:

- Last Backup Created
- Last Backup Restored

Do not show empty rows such as:

- Never
- N/A
- No activity

Additional archive information remains behind details expansion.

Expanded archive information order:

1. Backup Size
2. Backup Period
3. Backup Health

Backup Health display:

- 🟢 Good
- 🟠 Warning
- 🔴 Critical

Health status explanation remains hidden unless details or intervention are required.

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

## Backup Download Result

Backup downloaded successfully.

This is a transient success message.

It may auto-dismiss.

## Restore Backup Flow

Restore Backup -> Choose Backup File -> Processing -> Backup Restored

Hide engine implementation details unless intervention is required.

## Restore Results

Always show:

- Imported count
- Duplicate count
- Warning count when present

Restore result summaries remain visible.

Do not auto-dismiss restore result summaries.

The user remains on the Storage page.

## Warning Behaviour

Warnings do not block restore.

Warnings are shown in the restore summary.

## Critical Failure Behaviour

Critical failures block restore.

Critical failures remain visible until resolved or dismissed by the user.

## Profile Conflict Handling

Options:

- Keep Current
- Restore Backup
- Keep Both

No default selection.

Single conflict review screen.

Do not show repeated conflict dialogs.

Multiple profile conflicts are resolved together before restore continues.

Keep Both naming:

Profile Name (YYYY-MM-DD)

Date source: Profile Creation Date.

Avoid Copy, Copy 2, Copy 3.

## Information Hierarchy

Simple by default.

Detailed when requested.

Advanced information should remain behind Show Details style controls.

## Remaining UX Design Work

- Storage page wireframe
- Archive Browser definition
- Archive Management definition
- Mobile layout review
- Tablet layout review
- Desktop layout review
- Accessibility review
- Runtime validation criteria
