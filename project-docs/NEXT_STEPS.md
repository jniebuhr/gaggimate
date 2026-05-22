# Next Steps

## Current Status

Completed:

1. Preserve stable responsive shell.
2. Remove unsafe/admin-oriented surfaces from the active GaggiGo shell.
3. Harden Settings into safe read-only GaggiMate viewer.
4. Reuse LibraryService + IndexedDBService architecture.
5. Enable profile cache fallback.
6. Enable shot history cache fallback.
7. Enable offline analyzer routing.
8. Enable offline statistics from cached data.
9. Add cached settings snapshot fallback.
10. Add cache/source visibility indicators.
11. Add SafeGaggiMateClient data boundary.
12. Migrate ProfileEdit safe operations.
13. Migrate ProfileList safe operations.
14. Add ApiService request classification.
15. Audit runtime/non-web diffs.
16. Complete pre-sync architecture audit.

---

## Current Phase

Pre-sync validation gate.

The architecture phase is largely complete.

Remaining work is now validation-oriented.

---

## Immediate Priority

1. Local runtime validation.
2. Connected/offline/reconnect verification.
3. Confirm ProfileList operations after migration.
4. Confirm no unexpected ApiService warnings for documented safe operations.
5. Confirm empty states behave correctly.
6. Then begin Safe Sync v1 design.

---

## Safe Sync v1 Direction

Initial scope:

- notes
- ratings
- safe metadata
- profile drafts
- manual sync workflow first

Avoid initially:

- automatic two-way sync
- conflict-heavy sync
- runtime/admin configuration sync

---

## Runtime Separation Rule

Frontend/PWA work and runtime/controller work are now separated into different review buckets.

Do not blindly merge runtime/controller diffs together with frontend observer work.

Current runtime buckets:

1. telemetry + scale metadata enhancements
2. configurable button/runtime profile behaviour
3. predictive runtime improvement
4. OTA timeout adjustment

---

## Working Model

```text
GaggiMate
= runtime owner
= telemetry source
= source authority

GaggiGo
= offline-first observer frontend
= cache layer
= analysis workspace
= safe sync client later
```

Merge-back compatibility remains mandatory.
