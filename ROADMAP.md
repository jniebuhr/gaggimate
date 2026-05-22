# GaggiGo MVP Roadmap

## Current Status

GaggiGo is an offline-first observer frontend for GaggiMate with a documented merge-back direction.

Core architecture direction remains valid.

However:

```text
Analyzer and Statistics are currently under active debug.
```

Current regression:

- analyzer graphs can fail to render
- statistics can return zeroes
- statistics batching can become extremely slow
- metadata-only shot rows can be treated as fully-loaded payloads
- `gaggimate-cache` source handling is not yet fully unified

Do not treat offline analyzer/statistics behaviour as complete until the active debug handover is resolved and validated.

Reference:

```text
project-docs/ANALYZER_STATISTICS_DEBUG_HANDOVER.md
```

---

## Phase 1 — Safety + Live Observer Frontend

Status: complete.

Completed:

- responsive shell retained
- desktop sidebar retained
- mobile dropdown retained
- safe informational homepage
- unsafe/admin-oriented routes removed from GaggiGo shell
- unsafe/admin-oriented navigation removed from GaggiGo shell
- live proxy integration
- websocket integration
- LibraryService abstraction reused
- ShotHistory migrated onto unified data layer
- Settings restored as read-only GaggiMate settings viewer
- safe observer-mode frontend direction established

Merge-back direction:

- long term this should become app mode / feature gating rather than permanent upstream deletion.

---

## Phase 2 — Offline-First Behaviour + Hardening

Status: partially complete.

Current architecture:

```text
Browser
↓
LibraryService
↓
SafeGaggiMateClient + IndexedDBService
```

Integrated:

- cached startup behaviour
- background live refresh attempts
- fast offline UI boot
- profile cache fallback
- shot history cache fallback
- settings snapshot fallback
- cache-first rendering model
- source/cache visibility indicators
- safe websocket request classification
- safe profile operation wrapping
- ApiService hardening pass
- repository audit pass
- runtime/non-web diff classification

Still actively being stabilised:

- analyzer cache fallback
- statistics cache fallback
- full payload hydration rules
- metadata-only shot handling
- source contract unification
- `gaggimate-cache` handling

Current blocker:

```text
The UI originally assumed:
- gaggimate
- browser

The data layer introduced:
- gaggimate-cache

without fully updating all callers.
```

Result:

- cached GaggiMate rows may be routed as browser uploads
- empty sample arrays may be treated as loaded payloads
- analyzer graphs may receive empty data
- statistics may skip shots or report zeroes

Immediate priority:

1. stabilize analyzer/statistics payload handling
2. validate online behaviour
3. validate offline cached full-payload behaviour
4. confirm connected/offline/reconnect workflow
5. confirm no unexpected ApiService warnings

No new features before this is stable.

---

## Phase 3 — Safe Sync

Status: blocked behind analyzer/statistics validation.

Sync work must not begin until:

- analyzer graphs work correctly from cached full payloads
- statistics works correctly from cached full payloads
- metadata-only rows no longer pretend to be loaded
- `gaggimate-cache` handling is explicit and stable
- the cache-first workflow is validated against a real GaggiMate runtime

Initial sync scope when unblocked:

- notes
- ratings
- profile drafts
- safe metadata
- manual sync workflow first

Planned behaviour:

- dirty-state tracking
- manual sync queue
- safe merge behaviour
- export/import tooling

Do not start with:

- automatic two-way profile sync
- machine/runtime configuration sync
- conflict-heavy sync behaviour

---

## Phase 4 — Hardening / PWA / Packaging

Status: planned.

Planned:

- remove inherited dead services
- further source unification
- performance optimisation
- statistics indexing improvements
- installable PWA behaviour
- packaging/distribution
- runtime cleanup
- end-to-end testing
- feature-gating/app-mode architecture

---

## Architectural Direction

```text
GaggiMate
= runtime owner
= telemetry source
= source authority

GaggiGo
= observer frontend
= analysis layer
= historical viewer
= offline-first workspace
= safe sync client later
```

Important implementation rule:

```text
GaggiMate controls the machine.
GaggiGo observes, stores, analyses, and later syncs safe data.
```

Do not reintroduce:

- brew control
- grinder control
- scales control
- PID/autotune
- OTA
- Bluetooth device management
- raw websocket admin
- unrestricted settings writes

Merge-back compatibility remains a hard requirement.
