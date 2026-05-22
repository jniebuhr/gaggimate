# ProfileList Migration Audit

## Purpose

Track the last large page-level migration to the safe client boundary.

File:

```text
web/src/pages/ProfileList/index.jsx
```

This file is large and central to profile behaviour. It should be edited with a patch-capable local editor rather than by blind full-file replacement.

---

## Current Status

Already completed:

- `ProfileEdit` routes profile load/save through `SafeGaggiMateClient`.
- `SafeGaggiMateClient` exposes named safe data methods for profile list behaviour.
- `ApiService` classifies documented safe data request types and warns for requests outside that set.

Remaining:

- `ProfileList` still calls low-level request methods directly for profile mutations.

These are safe data operations, not machine controls.

---

## Required Change

Add the safe client import:

```js
import { safeGaggiMateClient } from '../../services/SafeGaggiMateClient.js';
```

Then replace direct profile data calls with the named methods already available on `safeGaggiMateClient`:

- `reorderProfiles(order)`
- `deleteRemoteProfile(id)`
- `selectProfile(id)`
- `favoriteProfile(id)`
- `unfavoriteProfile(id)`
- `saveProfile(profile)`

Before each call, ensure:

```js
safeGaggiMateClient.setApiService(apiService);
```

---

## Behaviour Requirement

Do not change user behaviour.

This is boundary-only work:

```text
same API contracts
same UI behaviour
same GaggiMate data writes
cleaner frontend data boundary
```

---

## Test Checklist

After migration, confirm:

- profile list loads
- profile select works
- favourite toggle works
- duplicate works
- import works
- profile removal works
- clear non-selected works
- reorder persists
- cached profile fallback still works
- no warnings for documented safe data operations

---

## Merge-Back Note

This migration supports merge-back because it keeps GaggiMate contracts intact while making frontend data operations explicit and auditable.
