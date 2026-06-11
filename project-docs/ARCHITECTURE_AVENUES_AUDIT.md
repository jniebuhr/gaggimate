# ARCHITECTURE_AVENUES_AUDIT.md

## Purpose

Before selecting an architecture direction, enumerate realistic avenues, reject obvious dead ends, and identify the easiest viable validation path.

This document exists to prevent solution-first decision making.

---

## Current Evidence

Validated:

- Device-hosted assets serve correctly
- sw.js exists
- app.webmanifest exists
- Home Screen installation available on iPhone
- Installed app launches while GaggiMate is reachable

Failed:

- Offline app-shell relaunch
- Desktop direct-IP service worker availability

Current blocker:

```text
Offline app-shell survival
```

---

## Candidate Avenues

### Option 1

GaggiMate-hosted HTTP PWA

Status:

```text
PARTIALLY VALIDATED
```

Pros:

- Existing architecture
- No additional hosting
- Single-device deployment

Cons:

- Current runtime validation failure
- Direct-IP origin security concerns
- Service-worker behaviour not proven

Current ranking:

```text
MEDIUM
```

---

### Option 2

Hosted HTTPS PWA + GaggiMate Authority

Status:

```text
NOT YET VALIDATED
```

Pros:

- Likely secure-context eligibility
- Directly targets observed failure mechanism
- Reuses existing frontend architecture

Cons:

- Potential mixed-content restrictions
- API/WebSocket feasibility not yet proven

Current ranking:

```text
HIGH
```

Evidence required:

```text
Can HTTPS-hosted GaggiGo communicate with local GaggiMate without browser security restrictions preventing operation?
```

---

### Option 3

Hosted HTTPS Archive Viewer / Handoff Model

Status:

```text
NOT YET VALIDATED
```

Pros:

- Technically simple
- Uses already validated archive model
- Avoids live API constraints

Cons:

- Less seamless user workflow
- Not original single-app objective

Current ranking:

```text
MEDIUM-HIGH
```

---

### Option 4

Local Bridge

Status:

```text
NOT RECOMMENDED AT THIS STAGE
```

Pros:

- Could solve origin constraints

Cons:

- Additional runtime component
- Increased complexity
- Requires stronger justification

Current ranking:

```text
LOW
```

---

### Option 5

Native Wrapper

Status:

```text
REJECTED FOR NOW
```

Reason:

```text
Introduces significant complexity before simpler alternatives are exhausted.
```

---

## Current Ranking

```text
1. Audit HTTPS-hosted frontend + GaggiMate API feasibility
2. Audit HTTPS archive-only model
3. Re-evaluate GaggiMate-hosted HTTP limitations
4. Local bridge
5. Native wrapper
```

---

## Governance Decision

No architecture selected.

No implementation authorised.

Next action:

```text
Evidence collection.

Determine whether HTTPS-hosted GaggiGo can communicate safely and practically with local GaggiMate APIs and WebSockets.
```

Architecture selection occurs only after evidence review.
