# Next Steps

## Current Status

Completed:

1. Preserve stable responsive shell.
2. Remove unsafe routes and navigation.
3. Harden Settings into safe read-only GaggiMate viewer.
4. Reuse LibraryService + IndexedDBService architecture.
5. Enable profile cache fallback.
6. Enable shot history cache fallback.
7. Enable offline analyzer routing.
8. Enable offline statistics from cached data.
9. Add cached settings snapshot fallback.

## Active Phase

Phase 2: Offline-first hardening before sync.

## Current Build Priority

1. Polish offline empty states.
2. Add clearer cache/source indicators.
3. Reduce proxy timeout noise when GaggiMate is offline.
4. Remove remaining live-only assumptions.
5. Audit ApiService safe operations and websocket boundaries.
6. Remove inherited dead services/code.
7. Improve statistics indexing/performance.
8. Prepare safe local notes/ratings sync model.
9. Prepare manual sync queue workflow.
10. Later: investigate PWA/install behaviour and end-to-end testing.

## Safety Boundary

Do not reintroduce:

- OTA controls
- PID autotune
- Bluetooth device management
- direct brew/steam/water/grinder controls
- raw WebSocket admin UI
- unrestricted machine settings writes

## Working Model

GaggiMate remains the machine authority.

GaggiGo observes, caches, analyses, and later synchronises approved safe data only.
