# GaggiGo MVP Roadmap

## Current Status

GaggiGo is an offline-first observer frontend and local mirror layer for GaggiMate.

Core cache-first architecture direction is now functioning.

```text
GaggiMate
= runtime owner
= telemetry source
= machine authority

GaggiGo
= offline-first observer frontend
= local IndexedDB mirror
= historical viewer
= analyzer/statistics workspace
= safe sync client later
```

The project has now moved out of broad analyzer/history regression territory and into cleanup + hardening before sync.

---

## Phase 1 — Safety + Live Observer Frontend

Status: complete.

Completed:

- responsive shell retained
- desktop sidebar retained
- mobile dropdown retained
- safe informational homepage
- unsafe/admin-oriented routes removed from active GaggiGo shell
- websocket integration
- live proxy integration
- LibraryService abstraction reused
- safe observer frontend direction established
- Settings retained as filtered read-only viewer
- SafeGaggiMateClient integration

Merge-back direction:

- long term this should become app mode / feature gating rather than permanent upstream deletion.

---

## Phase 2 — Offline-First Behaviour + Cache Mirror Stabilisation

Status: major foundation complete, hardening ongoing.

Current architecture:

```text
GaggiMate API/WebSocket
↓
hydration/import path
↓
IndexedDB local mirror
↓
LibraryService
↓
History / Analyzer / Statistics / Profiles
```

Integrated and confirmed:

- fast offline UI boot
- cached startup behaviour
- shot history cache fallback
- analyzer cache fallback
- full shot payload hydration into IndexedDB
- profile cache fallback
- live profile refresh path
- settings snapshot fallback
- cache-first rendering model
- source/cache indicators
- safe websocket request classification
- safe profile operation wrapping
- ApiService hardening pass
- repository audit pass

Critical architecture fix completed:

```text
hydrateGaggiMateShotIndex()
→ hydrates missing .slog payloads into IndexedDB
```

This allows:

- offline analyzer graphs
- local full-payload persistence
- cache-first statistics direction
- proper mirror behaviour

Recent fixes completed:

- fixed metadata-only payload handling
- fixed analyzer empty-sample detection
- fixed cached GaggiMate analyzer routing
- fixed shot history hydration timing
- fixed live profile preference while connected
- added eager full-payload hydration during cache refresh

---

## Current Hardening Targets

Still actively being stabilised:

1. Statistics cache-only behaviour.
2. Statistics missing-payload reporting.
3. Offline profile cache cleanup.
4. Connected/offline/reconnect workflow validation.
5. Offline empty-state polish.
6. Cache/source indicator clarity.
7. Terminal/proxy noise reduction.
8. Dead-code audit.
9. ApiService safe-boundary mapping.

Rules:

```text
No sync work before hardening completes.
No new product features before hardening completes.
No parallel cache architecture.
```

---

## Phase 3 — Safe Sync

Status: blocked behind hardening validation.

Sync work must not begin until:

- Statistics is confirmed cache-first.
- connected/offline/reconnect behaviour is validated.
- missing payload handling is stable.
- profile cache behaviour is stable.
- no unexpected ApiService warnings remain.
- local mirror behaviour is deterministic.

Initial sync scope when unblocked:

- notes
- ratings
- safe metadata
- profile drafts
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
- unrestricted live mutation

---

## Phase 4 — Hardening / PWA / Packaging

Status: planned.

Planned:

- remove inherited dead services
- statistics indexing improvements
- performance optimisation
- installable PWA behaviour
- packaging/distribution
- runtime cleanup
- end-to-end testing
- feature-gating/app-mode architecture

---

## Architectural Direction

```text
GaggiMate
= machine controller
= telemetry authority
= runtime owner

GaggiGo
= observer frontend
= analysis layer
= offline-first workspace
= historical viewer
= local mirror
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
