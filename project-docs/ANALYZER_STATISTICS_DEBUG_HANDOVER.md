# HANDOVER CARD — Analyzer / Statistics Debug

## FIRST INSTRUCTION

Before doing any work:

1. Check current GitHub state.
2. Confirm branch is `gaggigo-mvp`.
3. Read current project docs.
4. Compare against `TyrLabsOS/GaggiGo` `master` where needed.
5. Do not rely only on this handover.

### Commands

```powershell
cd C:\Users\ed\GaggiGo
git checkout gaggigo-mvp
git pull origin gaggigo-mvp
git status
```

### Read

- `CURRENT_STATE.md`
- `ROADMAP.md`
- `project-docs/DATA_STORAGE_MODEL.md`
- `project-docs/AUTO_REFRESH_MODEL.md`
- `project-docs/CACHE_FIRST_WORKFLOW.md`
- `project-docs/PRE_SYNC_AUDIT_GATE.md`
- `project-docs/SANITY_VALIDATION.md`
- `project-docs/ANALYZER_STATISTICS_DEBUG_HANDOVER.md`

---

## Repo

```text
TyrLabsOS/GaggiGo
```

### Working branch

```text
gaggigo-mvp
```

### Reference branch

```text
master
```

Do not use GaggiBre as upstream/reference for this task.

---

## PROJECT MODEL

### GaggiMate

- live machine authority
- source of raw shot/profile/history data
- machine/runtime owner

### GaggiGo

- offline mirror
- viewer
- analyser/statistics workspace
- safe sync client later

Do not reintroduce:

- brew control
- grinder control
- scales control
- PID/autotune
- OTA
- raw websocket admin
- unrestricted settings writes

### Settings exception

- GaggiMate remains settings authority
- GaggiGo only shows filtered read-only settings
- offline settings view is filtered cached snapshot only
- no secrets cached/displayed raw

---

## CURRENT PROBLEM

### Shot Analyzer

- no graphs

### Statistics

- reports zeroes
- analyses/batches 65 shots 5 at a time
- takes minutes
- then produces little/no usable output

These worked before today’s attempted data-path changes.

---

## DO NOT PATCH FIRST

Investigation already found key evidence.
Next work should be a small targeted fix plan, then patch one file at a time.

No broad rewrites.
No new services.
No new cache architecture.
No sync work.
No settings work.
No UI shell work.

---

## FILES TO FOCUS

### Primary suspects

- `web/src/pages/ShotAnalyzer/services/LibraryService.js`
- `web/src/pages/ShotAnalyzer/services/IndexedDBService.js`
- `web/src/pages/ShotHistory/index.jsx`
- `web/src/pages/ShotHistory/HistoryCard.jsx`
- `web/src/pages/ShotAnalyzer/index.jsx`
- `web/src/pages/Statistics/components/StatisticsView.jsx`

### Do not touch unless justified

- `web/src/index.jsx`
- `web/src/components/Navigation.jsx`
- `web/src/components/Header.jsx`
- `web/src/pages/Home/index.jsx`
- `web/src/pages/Settings/index.jsx`

---

## EVIDENCE FROM REPO COMPARISON

### Comparison

```text
TyrLabsOS/GaggiGo master
vs
TyrLabsOS/GaggiGo gaggigo-mvp
```

### StatisticsView.jsx

- unchanged between `master` and `gaggigo-mvp`
- SHA identical:

```text
4fbdb90b3e41c1f155246829473410c5a6f63431
```

Therefore the statistics batch code itself is not newly broken.
It always batches 5 at a time and calls:

```js
libraryService.loadShot(shotId, shot.source)
```

Then it skips shots when samples are missing/empty.

### ShotAnalyzer/index.jsx

- unchanged in relevant load path
- still assumes source types:
  - `gaggimate`
  - `browser`

It does not understand `gaggimate-cache` as a first-class source.

Analyzer loaded-payload check currently treats any samples array as loaded:

```js
hasLoadedShotPayload(item)
= Boolean(item) && Array.isArray(item.samples)
```

This means `samples: []` is treated as a loaded payload.

### LibraryService.js

Changed heavily on `gaggigo-mvp`.

#### master behaviour

```text
getAllShots('gaggimate')
→ fetch /api/history/index.bin
→ return rows source: gaggimate

loadShot(id, 'gaggimate')
→ fetch /api/history/{id}.slog
→ parseBinaryShot()
→ return samples[]
```

#### gaggigo-mvp behaviour

```text
getAllShots()
→ local IndexedDB mirror
→ cache/hydration logic
→ introduces gaggimate-cache
```

### IndexedDBService.js

#### master

Stores browser uploads only.

#### gaggigo-mvp

Stores cached GaggiMate mirrors as:

```text
source: gaggimate-cache
name/storageKey: gaggimate:{id}
gaggimateId
loaded
cachedAt
```

### ShotHistory/index.jsx

#### master

```text
fetches /api/history/index.bin directly
parses index
keeps list metadata
preserves loaded data only in React state when already loaded
```

#### gaggigo-mvp

```text
calls libraryService.getAllShots('both')
normalizes all rows through normalizeHistoryShot()
```

### Critical issue found

`normalizeHistoryShot()` currently creates:

```js
samples: Array.isArray(shot?.samples) ? shot.samples : []
```

So metadata-only rows become:

```js
samples: []
loaded: false
```

But Analyzer sees `samples: []` as loaded because it only checks `Array.isArray(samples)`.

Result:

```text
metadata-only shot
→ samples: []
→ Analyzer thinks payload is loaded
→ skips libraryService.loadShot()
→ chart receives empty samples
→ no graph
```

### HistoryCard.jsx

#### master analyzer link

```text
/analyzer/internal/{shot.id}
```

#### gaggigo-mvp analyzer link

```js
source === 'gaggimate' ? internal : external
```

So `gaggimate-cache` becomes:

```text
/analyzer/external/{id}
```

Analyzer route handling maps:

```text
internal → gaggimate
external → browser
```

Therefore cached GaggiMate shots are routed as browser shots.

This is another confirmed contract mismatch.

---

## LIKELY ROOT CAUSE

The UI components still use the original two-source contract:

```text
gaggimate
browser
```

But the data layer introduced a third source:

```text
gaggimate-cache
```

without updating all callers.

Result:

- cached GaggiMate rows are sometimes treated as browser uploads
- metadata-only rows are sometimes treated as loaded shots
- loadShot receives wrong id/source pair
- full samples are not reliably loaded
- analyzer graph has no data
- statistics loops through candidates and skips them as null/empty

---

## PATCH PLAN TO PROPOSE BEFORE EDITING

### Patch 1

Change Analyzer payload check.

#### Current

```js
Array.isArray(item.samples)
```

#### Required

```js
Array.isArray(item.samples) && item.samples.length > 0
```

#### File

```text
web/src/pages/ShotAnalyzer/index.jsx
```

#### Reason

Do not treat metadata-only rows as loaded payloads.

#### Risk

Low. Makes analyzer call `libraryService.loadShot()` when samples are empty.

---

### Patch 2

Stop ShotHistory from assigning `samples: []` to metadata-only rows.

#### File

```text
web/src/pages/ShotHistory/index.jsx
```

#### Change

Only include `samples` when actual samples exist.
Do not create empty samples array as a default.

#### Reason

Avoid false loaded-payload signal.

#### Risk

Low-medium. Need to preserve HistoryCard behaviour.

---

### Patch 3

Fix HistoryCard analyzer route for `gaggimate-cache`.

#### File

```text
web/src/pages/ShotHistory/HistoryCard.jsx
```

#### Current

```js
source === 'gaggimate' ? internal : external
```

#### Required

```text
source === 'gaggimate' || source === 'gaggimate-cache'
→ internal or a new cache-aware route decision
```

Simplest likely fix:
Treat `gaggimate-cache` as internal/GaggiMate-origin for analyzer route.

#### Reason

Do not route cached GaggiMate shots as browser uploads.

#### Risk

Medium. Need to ensure loadShot can resolve id/storageKey correctly.

---

### Patch 4

Make `LibraryService.loadShot` explicitly support `gaggimate-cache`.

#### File

```text
web/src/pages/ShotAnalyzer/services/LibraryService.js
```

#### Required

- `gaggimate`
  - live `.slog` fetch path still works as original when connected
- `gaggimate-cache`
  - resolve local IndexedDB by storageKey/name/id/gaggimate:{id}
  - return full cached payload if samples exist
  - if missing samples and online, hydrate once from `.slog` using gaggimateId/id
- `browser`
  - IndexedDB browser upload path

#### Reason

Align data layer with actual three-source model.

#### Risk

Medium. Must be surgical.

---

### Patch 5

Statistics should not silently return all zeroes when no full payloads exist.

#### File

```text
web/src/pages/Statistics/components/StatisticsView.jsx
```

Only after patches 1-4.

#### Possible improvement

If `entries.length === 0` but `shotList.length > 0`:
show missing hydrated payload message rather than fake zero stats.

#### Risk

Low-medium.

---

## VALIDATION AFTER PATCHES

### Online

1. Pull latest.
2. Start app.
3. Open Shot History.
4. Expand one shot.
5. Confirm full payload loads.
6. Open same shot in Analyzer.
7. Confirm graph renders.
8. Run Statistics.
9. Confirm stats populate and speed is sane.

### Offline/cache

1. Load a shot once online.
2. Confirm IndexedDB shot has:
   - source
   - id
   - storageKey
   - gaggimateId if relevant
   - loaded
   - samples exists
   - samples.length > 0
3. Disconnect GaggiMate.
4. Open Analyzer.
5. Confirm graph renders from cache.
6. Run Statistics.
7. Confirm cached loaded shots are analysed.
8. Confirm metadata-only shots are skipped/reported, not counted as zero.

---

## IMPORTANT

Do not proceed to sync until:

- Analyzer graphs work from cached full payloads
- Statistics works from cached full payloads
- metadata-only rows do not pretend to be loaded
- gaggimate-cache source handling is explicit and stable
