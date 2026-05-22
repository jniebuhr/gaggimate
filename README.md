# GaggiGo

Offline-first companion frontend for GaggiMate.

GaggiGo focuses on:

- profiles
- shot history
- statistics
- analysis
- local-first workflows
- safe synchronisation later
- observability

GaggiGo is intentionally not:

- remote machine control software
- firmware management software
- OTA management
- unrestricted WebSocket administration
- brew/steam/grinder/water control UI

---

# Current Direction

GaggiGo reuses parts of the existing GaggiMate frontend shell while removing unsafe machine-control functionality.

The long-term goal is a stable offline-first PWA capable of:

- mirroring safe GaggiMate data locally
- viewing shot history offline
- analysing historical brew data offline
- running statistics from local IndexedDB data
- synchronising approved safe data later
- preserving a familiar frontend experience

---

# Core Architecture

```text
GaggiMate
= machine authority
= runtime owner
= source of truth for raw machine-produced data

GaggiGo
= observer frontend
= offline-first analysis workspace
= local IndexedDB mirror
= safe sync client later
```

Correct workflow:

```text
GaggiMate API/WebSocket/files
↓
Safe hydration/import layer
↓
IndexedDB local mirror
↓
LibraryService
↓
History / Analyzer / Statistics / Profiles
```

Analyzer/statistics/history should run from local IndexedDB data.

GaggiMate refreshes and hydrates the mirror.

The UI should not repeatedly fetch live telemetry for graph rendering.

---

# Settings Exception

Settings follow a different model.

```text
GaggiMate = settings read/write authority
GaggiGo = read-only filtered settings viewer
Offline = filtered cached snapshot only
```

Sensitive/admin/runtime values must not be exposed or cached raw.

Examples:

- WiFi credentials
- HomeKit data
- MQTT credentials
- tokens/secrets
- private runtime configuration

---

# Current MVP Status

Working foundation:

- frontend boots successfully
- responsive navigation restored
- mobile dropdown navigation working
- safe landing page active
- unsafe routes removed from GaggiGo shell
- safe observer-mode frontend direction established
- IndexedDB persistence layer integrated
- cached GaggiMate shot mirroring
- cached GaggiMate profile mirroring
- offline-first startup behaviour
- source/cache visibility indicators
- read-only settings snapshot fallback
- SafeGaggiMateClient boundary layer
- ApiService request classification/hardening

Current active engineering focus:

```text
full shot payload hydration
↓
stable IndexedDB mirror
↓
offline analyzer/statistics correctness
```

Before sync work:

- analyzer graphs must run from local samples
- statistics must run from local samples
- cached payloads must survive refreshes
- live metadata must not overwrite hydrated payloads

---

# Current Main Areas

```text
web/src/pages/ShotAnalyzer/services/LibraryService.js
```

Unified local read layer.

```text
web/src/pages/ShotAnalyzer/services/IndexedDBService.js
```

Primary persistent local mirror.

```text
web/src/services/SafeGaggiMateClient.js
```

Safe machine interaction boundary.

```text
web/src/services/ApiService.js
```

API/WebSocket classification and protection layer.

```text
project-docs/
```

Architecture, audit, and workflow documentation.

---

# Deprecated Direction

`LocalCacheService` is deprecated.

Do not build new sync/cache architecture on it.

Authoritative persistence path is:

```text
LibraryService
↓
IndexedDBService
↓
IndexedDB
```

---

# Development Rules

- small commits
- reversible changes
- preserve stable architecture
- avoid uncontrolled rewrites
- safety before polish
- no parallel cache architectures
- cache-first local workflows
- machine authority remains with GaggiMate

Do not fight the original responsive shell architecture.

Desktop:
- sidebar navigation

Mobile:
- dropdown navigation

---

# Current Build Focus

Current focus areas:

1. Stable IndexedDB hydration
2. Offline analyzer correctness
3. Offline statistics correctness
4. Cache/source unification
5. ApiService safe-boundary mapping
6. Dead-code cleanup
7. Safe sync later

---

# License

Inherited upstream licensing remains applicable.
