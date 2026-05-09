# Shot History ID Change to Timestamp-Based Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change shot history IDs from sequential integers (1, 2, 3...) to timestamp-based values so that imported shots never collide with existing ones.

**Architecture:** Two storage systems need updating:
1. **Device** (C++): Use Unix timestamp as shot ID instead of `historyIndex` counter
2. **Browser** (IndexedDB import): When importing, detect ID collisions and generate new timestamp-based IDs

**Tech Stack:** C++ (ESP32), JavaScript/IndexedDB

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/display/plugins/ShotHistoryPlugin.cpp` | Device-side recording — generate timestamp-based `currentId` |
| `src/display/plugins/ShotHistoryPlugin.h` | `currentId` is String, no structural changes |
| `web/src/pages/ShotHistory/historyArchive.js` | Browser import — collision detection and new ID generation |

---

## Task 1: Change Device Shot ID Generation to Timestamp

**Files:**
- Modify: `src/display/plugins/ShotHistoryPlugin.cpp:440-445`
- Modify: `src/display/plugins/ShotHistoryPlugin.cpp:66-70` (padId may become unnecessary but keep for compatibility)

- [ ] **Step 1: Read current ID generation around line 443**

Run: Read lines 440-450 of `src/display/plugins/ShotHistoryPlugin.cpp`

Current code:
```cpp
currentId = padId(String(controller->getSettings().getHistoryIndex()));
```

- [ ] **Step 2: Replace with timestamp-based ID**

Replace the line:
```cpp
currentId = padId(String(controller->getSettings().getHistoryIndex()));
```

With:
```cpp
currentId = padId(String((uint32_t)getTime()), 10);
```

Note: `getTime()` returns `unsigned long` (Unix epoch seconds), so casting to `uint32_t` is safe until 2106. The `padId` is kept for filename compatibility (still creates `/h/1234567890.slog` format).

- [ ] **Step 3: Verify padId function still works for long IDs**

Run: Read lines 66-70 to confirm `padId` handles IDs longer than 6 digits.

Current code:
```cpp
String padId(String id, int length = SHOT_ID_LENGTH) {
    char buffer[SHOT_ID_LENGTH + 1];
    snprintf(buffer, sizeof(buffer), "%0*d", length, id.toInt());
    return String(buffer);
}
```

Problem: `id.toInt()` truncates to `int`, which overflows for large timestamps (~2038 overflow). The default `length = SHOT_ID_LENGTH = 6` is too short for timestamps (10 digits).

- [ ] **Step 4: Update padId to handle timestamp-length IDs**

Replace `padId` function with:
```cpp
String padId(String id, int length = 10) {
    char buffer[32];
    snprintf(buffer, sizeof(buffer), "%0*lu", length, id.toInt());
    return String(buffer);
}
```

Wait — `id.toInt()` still overflows. Better approach: pass `uint32_t` directly:

```cpp
String padId(uint32_t id, int length = 10) {
    char buffer[32];
    snprintf(buffer, sizeof(buffer), "%0*lu", length, (unsigned long)id);
    return String(buffer);
}
String padId(const String& id, int length = 10) {
    return padId((uint32_t)id.toInt(), length);
}
```

- [ ] **Step 5: Update call site to pass uint32_t timestamp directly**

Replace:
```cpp
currentId = padId(String((uint32_t)getTime()), 10);
```

With:
```cpp
currentId = padId((uint32_t)getTime());
```

- [ ] **Step 6: Commit**

```bash
cd src/display/plugins
git add ShotHistoryPlugin.cpp
git commit -m "feat(shot history): use timestamp as shot ID instead of sequential index"
```

---

## Task 2: Fix Browser Import Collision Handling

**Files:**
- Modify: `web/src/pages/ShotHistory/historyArchive.js:72-98`

- [ ] **Step 1: Read import logic**

Run: Read lines 72-105 of `web/src/pages/ShotHistory/historyArchive.js`

Key code:
```javascript
const shotId = String(rawShot.id || rawShot.timestamp || Date.now());
const storageKey = `history-${shotId}.json`;
```

The problem: if `rawShot.id` is `1` and `history-1.json` already exists, it overwrites.

- [ ] **Step 2: Check if shot already exists before saving**

Replace the import loop body with collision-aware logic:

```javascript
for (const rawShot of rawShots) {
    const hasSamples = Array.isArray(rawShot?.samples) && rawShot.samples.length > 0;
    const hasCoreHistoryFields = rawShot?.id && rawShot?.timestamp && rawShot?.profile;

    if (!hasSamples && !hasCoreHistoryFields) {
      continue;
    }

    // Generate unique ID: prefer timestamp, fallback to Date.now() if needed
    let shotId = String(rawShot.timestamp || rawShot.id || Date.now());

    // Check for collision and generate new ID if needed
    let storageKey = `history-${shotId}.json`;
    let existingShot = await indexedDBService.getShotByStorageKey(storageKey);

    if (existingShot) {
      // Shot with this ID already exists — generate new timestamp-based ID
      const timestamp = Date.now();
      shotId = String(timestamp);
      storageKey = `history-${shotId}.json`;
      ESP_LOGD("ShotHistory", "ID collision on import, generated new ID: %s", shotId);
    }

    const normalizedNotes = normalizeNotes(rawShot.notes, storageKey);

    const browserShot = {
      ...rawShot,
      id: shotId,
      name: storageKey,
      storageKey,
      source: 'browser',
      loaded: hasSamples,
      notes: normalizedNotes,
      data: null,
    };

    await indexedDBService.saveShot(browserShot);
    await notesService.saveNotes(storageKey, 'browser', normalizedNotes);
    importedShots.push(browserShot);
  }
```

Note: This requires `indexedDBService.getShotByStorageKey()` — if it doesn't exist, use an alternative check (e.g., try to get by ID first, catch conflict error).

- [ ] **Step 3: Verify IndexedDB service has getShotByStorageKey or implement fallback**

Run: Grep `indexedDBService` for existing get methods:
```bash
grep -n "getShot" web/src/pages/ShotAnalyzer/services/IndexedDBService.js
```

If no `getShotByStorageKey` exists, use `getShot(id)` and check if it returns a valid shot, or use `saveShot` with conflict detection.

Alternative simpler approach: just always generate a new ID on import using `Date.now()`:
```javascript
// Always generate a new unique ID on import to prevent overwrites
const shotId = String(Date.now());
const storageKey = `history-${shotId}.json`;
```

This is simpler and guarantees no collision, but loses the link to original timestamp. The user should decide which matters more.

- [ ] **Step 4: Commit**

```bash
cd web/src/pages/ShotHistory
git add historyArchive.js
git commit -m "feat(shot history): generate new ID on import to prevent overwriting existing shots"
```

---

## Self-Review Checklist

1. **Spec coverage:** The user's requirement is "no duplicate ID on import because date is always different" — Task 1 ensures new device shots use timestamps, Task 2 ensures imported shots never collide. Both covered.

2. **Placeholder scan:** No TBD/TODO placeholders. Steps show actual code.

3. **Type consistency:** `currentId` remains `String` throughout. `padId` signature updated to accept `uint32_t` directly. Import uses `Date.now()` which returns `number` — converted to `String` consistently.

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-05-05-shot-history-timestamp-id.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
