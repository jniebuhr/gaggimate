ARCHIVE_UX_SPECIFICATION.md

Status

Version: Draft 1.2

Status: Archive UX Implementation Complete / Runtime Validation Complete

Authority Level: Archive UX Authority

Archive Browser Status:

Deferred

Archive Management Status:

Deferred

Implementation Status:

Storage page implemented
Create Backup UI implemented
Restore Backup preview UI implemented
Restore Backup execution UI implemented
Archive Runtime Validation complete

Purpose

This document defines the user experience requirements for the GaggiGo archive system.

The archive engine implementation is already complete.

This document defines how users interact with that engine.

Design Principles

* Simple by default
* Detailed when requested
* Action first
* Information second
* Human language over technical language
* User controlled
* No surprise automation
* Warnings inform
* Critical failures block
* Success disappears
* Problems remain visible

User Terminology

Backend terminology remains Archive/Import/Export.

User-facing terminology becomes:

* Backup
* Restore
* Backup Ready
* Backup Restored

Navigation

Archive functionality is accessed through:

Storage

Storage Page

Purpose text:

Protect your coffee history and profiles by creating backups you can restore later.

Primary actions:

* Create Backup
* Restore Backup

Primary actions should be presented as cards.

Card 1:

Create Backup

Save a backup copy of your coffee data.

Card 2:

Restore Backup

Restore coffee data from a backup file.

Equal size and equal prominence.

Layout Rules

Storage

Purpose Text

Create Backup

Restore Backup

Archive Information

Action first. Information second.

First-Time User Experience

Show only purpose text and backup actions.

Do not show archive health, metadata or statistics.

Returning User Experience

Show only backup activities that have occurred.

Default archive information may include:

* Last Backup Created
* Last Backup Restored

Do not show empty rows such as:

* Never
* N/A
* No activity

Additional archive information remains behind details expansion.

Expanded archive information order:

1. Backup Size
2. Backup Period
3. Backup Health

Backup Health display:

* 🟢 Good
* 🟠 Warning
* 🔴 Critical

Health status explanation remains hidden unless details or intervention are required.

Archive information expands inline.

Do not use:

* Modals
* Dedicated pages
* Separate panels

Create Backup Flow

Create Backup -> Review Backup -> Create Backup -> Backup Ready -> Download Backup

Review Backup default view:

* Shots
* Profiles
* Estimated Size

Details view:

* Notes
* Tags
* Archive Period
* Archive Health

No automatic download.

Backup Download Result

Backup downloaded successfully.

This is a transient success message.

It may auto-dismiss.

Generated backup artifacts are temporary.

After successful download:

* Remove temporary artifact
* Return Storage page to normal state

The downloaded file becomes the authoritative backup copy.

Restore Backup Flow

Restore Backup -> Choose Backup File -> Processing -> Backup Restored

Hide engine implementation details unless intervention is required.

Restore Results

Always show:

* Imported count
* Duplicate count
* Warning count when present

Restore result summaries remain visible.

Do not auto-dismiss restore result summaries.

The user remains on the Storage page.

Warning Behaviour

Warnings do not block restore.

Warnings are shown in the restore summary.

Critical Failure Behaviour

Critical failures block restore.

Display:

Restore Blocked

The selected backup file could not be validated.

[ Show Details ]

Critical failures remain visible until resolved or dismissed by the user.

Technical details remain hidden until requested.

Profile Conflict Handling

Options:

* Keep Current
* Restore Backup
* Keep Both

No default selection.

Single conflict review screen.

Do not show repeated conflict dialogs.

Multiple profile conflicts are resolved together before restore continues.

Keep Both naming:

Profile Name (YYYY-MM-DD)

Date source: Profile Creation Date.

Avoid:

* Copy
* Copy 2
* Copy 3

Information Hierarchy

Simple by default.

Detailed when requested.

Advanced information should remain behind Show Details style controls.

Mobile Layout

Primary action cards are displayed vertically.

Create Backup

↓

Restore Backup

Use full-width cards and large touch targets.

Deferred Scope

Archive Browser

Status:

Deferred

Reason:

No demonstrated user requirement.

Backup ZIP files and manifests already provide inspection capability.

Additional tooling would duplicate existing functionality.

Archive Management

Status:

Deferred

Reason:

No demonstrated user requirement.

Would introduce unnecessary complexity into the MVP.

Future implementation remains possible if justified by real-world usage evidence.

Planning Outcome

Archive UX planning is considered complete.

The following areas have been defined and approved:

* Storage page
* Backup terminology
* Create Backup flow
* Restore Backup flow
* Backup activity display
* Backup information display
* Backup health presentation
* Success states
* Warning states
* Critical failure states
* Profile conflict handling
* Mobile-first layout
* Information hierarchy

Implementation Outcome

Archive UX implementation is complete.

The following areas are implemented:

* Storage page
* Create Backup UI
* Restore Backup preview UI
* Restore Backup execution UI

Runtime validation is complete.

Completed runtime validation:

* Create Backup export
* ZIP compression
* Archive import preview into an empty mirror
* Archive restore execution into an empty mirror
* History rendering after restore
* Analyzer rendering after restore
* Statistics rendering after restore
* Populated-mirror duplicate restore preview
* Populated-mirror duplicate restore execution

Validated populated-mirror duplicate protection:

* Shots to import: 0
* Duplicate shots: 141

Validated populated-mirror restore execution:

* Imported shots: 0
* Skipped duplicate shots: 141

Remaining future hardening:

* Large archive import behaviour testing
* Browser storage behaviour testing

Next Phase

Post-Validation Audit

Objectives:

* Browser storage behaviour testing remains the next immediate validation target
* Merge-back readiness audit follows browser storage testing
* Large archive import behaviour testing is deferred until sufficient real-world archive volume exists
* Keep Archive Browser deferred
* Keep Archive Management deferred
* Preserve archive authority alignment

Archive UX planning should not be reopened unless implementation uncovers a genuine UX gap.

