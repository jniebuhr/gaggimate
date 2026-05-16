// web/src/state/pendingProfile.js

let _profile = null;

/** Store a profile to be consumed once by ProfileEdit on next mount. */
export function setPendingProfile(profile) {
  _profile = profile;
}

/** Returns and clears the pending profile, or null if none. */
export function consumePendingProfile() {
  const p = _profile;
  _profile = null;
  return p;
}
