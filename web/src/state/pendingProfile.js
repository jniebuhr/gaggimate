let _profile = null;
let _expiresAt = 0;
const TTL_MS = 60_000;

/** Store a profile to be consumed once by ProfileEdit on next mount. */
export function setPendingProfile(profile) {
  _profile = profile;
  _expiresAt = Date.now() + TTL_MS;
}

/** Returns and clears the pending profile, or null if expired or absent. */
export function consumePendingProfile() {
  if (Date.now() > _expiresAt) {
    _profile = null;
    return null;
  }
  const p = _profile;
  _profile = null;
  return p;
}
