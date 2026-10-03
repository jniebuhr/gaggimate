// Browser-side cache of the profile list, keyed by the firmware's profile
// revision. Profiles rarely change (someone edits one now and then), yet every
// visit to the profiles or settings page used to wait on the ESP32 to read,
// parse and re-serialize every profile before anything rendered.
//
// The firmware sends its current revision in every full status frame (`prv`)
// and echoes it in list responses (`rev`). If the revision we cached matches,
// the cached list is rendered immediately and no request is made; otherwise a
// fresh list is requested and the cache replaced.

const STORAGE_KEY = 'gaggimate.profileList';

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function keyFor(variant) {
  return variant ? `${STORAGE_KEY}.${variant}` : STORAGE_KEY;
}

/** @returns {{ rev: number, profiles: object[] } | null} */
export function readCachedProfileList(variant = '') {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(keyFor(variant));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.rev !== 'number' || !Array.isArray(parsed?.profiles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedProfileList(rev, profiles, variant = '') {
  const store = storage();
  if (!store || typeof rev !== 'number' || !Array.isArray(profiles)) return;
  try {
    store.setItem(keyFor(variant), JSON.stringify({ rev, profiles }));
  } catch {
    // Quota or private-mode failures just mean the next visit fetches again.
  }
}

/**
 * True once the device has told us its current revision for this connection
 * (the full status snapshot has arrived). Until then a page should neither
 * fetch nor trust its cache, because the socket opens a moment before the
 * snapshot lands and fetching then would defeat the cache on every load.
 */
export function isDeviceRevisionKnown(machineValue) {
  return !!machineValue.connected && !!machineValue.stateReceived;
}

/**
 * True when the list held at `cachedRev` is still what the device would return.
 * Unknown device revision (older firmware, or no status frame yet) counts as
 * stale so behaviour matches the old always-fetch path.
 */
export function isProfileListCurrent(cachedRev, deviceRev) {
  return typeof deviceRev === 'number' && cachedRev === deviceRev;
}
