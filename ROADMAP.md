# GaggiGo MVP Roadmap

## Current Status

- Live GaggiMate integration working
- Profiles loading
- Shot history loading
- IndexedDB persistence operational
- Offline fallback operational
- Offline analyzer routing operational

## Phase 1 — Live Observer Frontend

Completed:
- responsive shell retained
- live proxy integration
- LibraryService abstraction
- offline shot persistence
- cached fallback behaviour

Remaining:
- statistics fixes
- settings cleanup
- remaining live-only assumptions

## Phase 2 — Offline-First Behaviour

Goals:
- cached startup
- background refresh
- fast offline UI boot
- local editing
- safe sync preparation

## Phase 3 — Safe Sync

Potential sync targets:
- notes
- ratings
- profile drafts
- metadata

## Phase 4 — Hardening

Planned:
- remove dead services
- improve statistics indexing
- performance optimisation
- PWA behaviour
- packaging
- end-to-end testing

## Architecture

GaggiMate:
- machine runtime
- control layer
- telemetry source

GaggiGo:
- observer frontend
- analysis layer
- cache layer
- offline-first workspace
