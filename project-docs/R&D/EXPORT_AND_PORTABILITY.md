# Export And Portability

Status: Candidate

This document clarifies the current export foundations already present inside GaggiGo/GaggiMate and identifies future packaging/polish opportunities.

This is not active roadmap work.

---

# Important Clarification

Export functionality is NOT a future blank feature.

Large parts of the export foundation already exist.

Future work should:

```text
extend
unify
package
polish
```

rather than rebuild export systems from scratch.

---

# Existing Export Foundations

## Replay Export

Already supports:

- replay video export
- replay image export
- replay JSON export
- MP4/WebM browser handling
- replay-state restoration after export

Current implementation already contains a dedicated replay/export state machine.

---

## Shot Export

Existing export payloads already support:

- shot metadata
- profile metadata
- timestamps
- telemetry samples
- notes
- ratings
- volume
- duration
- profile linkage

Current exports already resemble portable telemetry bundles.

---

## Profile Export

Existing profile export foundations already support:

- cleaned profile payloads
- metadata stripping
- export naming
- browser/local export
- GaggiMate export

---

## Browser And Offline Mirrors

Current architecture already supports:

- IndexedDB persistence
- cached telemetry
- cached profiles
- cached shot history
- offline mirrors

This already forms the foundation for:

```text
local vault architecture
```

---

# Future Packaging Opportunities

The missing work is mostly:

- unified export UX
- import UX
- backup/restore UX
- bundle packaging
- profile family exports
- replay package exports
- telemetry fixture exports
- portable archive formats

---

# Potential Future Bundle Concepts

## Shot Package

Potential contents:

- telemetry samples
- profile metadata
- replay metadata
- notes
- ratings
- annotations
- export preview image

---

## Profile Package

Potential contents:

- profile
- version metadata
- historical notes
- related shots

---

## Vault Backup

Potential contents:

- cached telemetry
- profiles
- notes
- ratings
- statistics
- replay exports

---

# Fixture Packages

Potential future use:

```text
known telemetry fixtures
```

Examples:

- ideal extraction
- heavy channeling
- unstable pressure
- unstable scale
- adaptive correction examples

Potential uses:

- regression testing
- analyzer development
- clustering development
- replay validation

---

# Architectural Direction

Correct long-term direction:

```text
portable telemetry workspace
```

not:

```text
cloud-locked account system
```

---

# Important Rule

Exports should remain:

- human-readable where possible
- versioned
- portable
- local-first
- privacy-friendly
- ecosystem-safe
