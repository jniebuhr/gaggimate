# Shot History & Notes API

How shot history and per-shot notes are stored on the device and accessed by clients. Schemas:
[`schema/shot_notes.json`](../schema/shot_notes.json) (notes) and
[`schema/shot_history.json`](../schema/shot_history.json) (shot JSON export).

## Storage

Shot files live in `/h/` on the history filesystem (SD card if present, LittleFS otherwise). Each shot is
identified by an increasing numeric id; files use the id zero-padded to 6 digits:

| File             | Content                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `/h/000031.slog` | Binary shot log (format in `src/display/models/shot_log_format.h`)                          |
| `/h/000031.json` | Shot notes (`schema/shot_notes.json`)                                                       |
| `/h/index.bin`   | Binary shot index (one entry per shot: timestamp, duration, volume, rating, profile, stats) |

Notes saved by firmware between the shot index (#449) and GM-251 used the unpadded id (`/h/31.json`). The
firmware renames such a file onto the padded name the first time the shot's notes are read or saved, or when
the index is rebuilt.

Shots of 7.5 s or less are discarded. When free space runs low, the oldest shots and their notes are deleted.

## HTTP endpoints

| Path                                  | Response                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /api/history/index.bin`          | Full shot index (binary, parsed by `web/src/pages/ShotHistory/parseBinaryIndex.js`) |
| `GET /api/history/recent.bin?limit=N` | Newest `N` (1–50, default 8) non-deleted entries, same format as `index.bin`        |
| `GET /api/history/000031.slog`        | Binary shot log (parsed by `web/src/pages/ShotHistory/parseBinaryShot.js`)          |
| `GET /api/history/000031.json`        | Raw notes file                                                                      |

All `/api/history/` requests return `503` while a firmware update is running.

## WebSocket requests

Requests carry a `rid` that is echoed in the response. Shot ids may be sent padded (`"000031"`) or unpadded
(`"31"`); the web UI sends the unpadded id.

### Get notes

```json
{ "tp": "req:history:notes:get", "rid": "1", "id": "31" }
```

```json
{
  "tp": "res:history:notes:get",
  "rid": "1",
  "notes": {
    "id": "31",
    "rating": 4,
    "beanType": "Ethiopia Guji",
    "doseIn": "18.0",
    "doseOut": "36.4",
    "ratio": "2.02",
    "grindSetting": "2.5",
    "balanceTaste": "balanced",
    "notes": "Sweet, slightly thin body"
  }
}
```

`notes` is `null` if the shot has no notes.

### Save notes

```json
{
  "tp": "req:history:notes:save",
  "rid": "2",
  "id": "31",
  "notes": { "rating": 4, "doseOut": "36.4" }
}
```

```json
{ "tp": "res:history:notes:save", "rid": "2", "msg": "Ok" }
```

The notes object replaces the stored file. The firmware also updates the shot index: `rating` becomes the
index rating, and a non-empty `doseOut` overrides the recorded volume.

### Delete a shot

```json
{ "tp": "req:history:delete", "rid": "3", "id": "31" }
```

Removes the shot log and its notes and marks the index entry deleted. Response `msg` is `"Ok"`.

### Delete all shots

```json
{ "tp": "req:history:delete-all", "rid": "4" }
```

```json
{ "tp": "res:history:delete-all", "rid": "4", "msg": "Ok", "deleted": 12 }
```

Removes every shot log (`.slog`) and notes file (`.json`) under `/h` on the history
filesystem (SD card if present, LittleFS otherwise) and recreates an empty `index.bin`.
`deleted` is the number of files removed. Like all `req:history:*` requests it is refused
with `"Update in progress"` while a firmware update is running, and while a shot is being
recorded it answers `"Recording in progress"` instead — retry once the brew (including the
scale-settling window) has finished. The shot id counter is kept monotonic, so later shots
never reuse ids of deleted ones.

### Rebuild the index

```json
{ "tp": "req:history:rebuild", "rid": "5" }
```

Answered immediately with `"msg": "Rebuild started"`; progress arrives as `evt:history-rebuild-progress`
events (see `docs/websocket-api.yaml`).

### Shot saved event

`evt:history-shot-saved` with the new shot `id` is sent once a finished shot is written to the history,
which can be several seconds after the brew ends while the scale weight settles.

## Automatic notes

When a shot is saved and its profile has a dose, the firmware writes that dose to the notes' `doseIn` unless
the notes already contain one. The dose comes from the profile as it was when the shot started, including any
temporary adjustments.

## Shot JSON export

The Shot History card download (`shot-<id>.json`) and the Shot Analyzer export contain the parsed shot log
merged with its index entry and notes; see `schema/shot_history.json` for all fields.

```json
{
  "id": "31",
  "version": 8,
  "profile": "Ratio profile",
  "profileId": "ef3jX3olik",
  "timestamp": 1791121751,
  "duration": 29150,
  "volume": 58.9,
  "rating": null,
  "incomplete": false,
  "phaseTransitions": [
    {
      "sampleIndex": 0,
      "phaseNumber": 0,
      "phaseName": "Pump",
      "transitionReason": 0,
      "transitionReasonLabel": "Unknown"
    }
  ],
  "finalExitReason": 9,
  "finalExitReasonLabel": "Ratio target",
  "brewDelay": 0,
  "samples": [
    {
      "t": 0,
      "tt": 93,
      "ct": 92.8,
      "tp": 1,
      "cp": 0.2,
      "fl": 3.1,
      "tf": 0,
      "pf": 0,
      "vf": 0,
      "v": 0,
      "ev": 0,
      "pr": 0,
      "wp": 0
    }
  ],
  "notes": {
    "id": "31",
    "doseIn": "30.0",
    "doseOut": "58.9",
    "ratio": "1.96",
    "balanceTaste": "balanced"
  }
}
```
