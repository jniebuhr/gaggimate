# Next Steps

## Current Status

Completed:

1. Preserve stable responsive shell.
2. Remove unsafe routes and navigation.
3. Harden Settings into safe/local-view focused page.
4. Add local cache foundation.
5. Add profile cache helper.
6. Wire Profiles page toward cached/offline behaviour.
7. Add empty state for blank-slate profile cache.

## Active Phase

Phase 2: Offline data layer.

## Next Build Priority

1. Verify Profiles cache behaviour with imported/sample data.
2. Add Shot History cache support.
3. Add offline Shot History fallback.
4. Wire Shot Analyzer to cached shot data.
5. Wire Statistics to cached history/profile data.
6. Add local draft/pending-change model for profile edits.
7. Add manual sync queue UI.
8. Define safe allowlisted adapter methods around ApiService.
9. Later: investigate same-network auto-sync after manual sync is reliable.

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

GaggiGo pulls safe data, caches it locally, enables offline viewing/analysis, and later syncs approved safe changes back through a manual sync flow.
