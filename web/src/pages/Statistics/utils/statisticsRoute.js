// Shared route helpers keep Analyzer/ProfileList -> Statistics deep links consistent.
const DEVICE_SOURCE_ALIASES = new Set(['internal', 'gm', 'gaggimate']);
const INVALID_PROFILE_NAMES = new Set(['no profile loaded']);

export function buildStatisticsProfileHref({ source, profileName }) {
  const trimmedName = String(profileName || '').trim();
  if (source !== 'gaggimate' || !trimmedName) return '/statistics';
  if (INVALID_PROFILE_NAMES.has(trimmedName.toLowerCase())) return '/statistics';
  return `/statistics/internal/${encodeURIComponent(trimmedName)}`;
}

export function parseStatisticsProfileRouteParams(params) {
  const alias = String(params?.sourceAlias || '')
    .trim()
    .toLowerCase();
  const rawProfileParam = params?.profileName;
  if (!DEVICE_SOURCE_ALIASES.has(alias) || !rawProfileParam) return null;

  let decodedName = String(rawProfileParam);
  try {
    decodedName = decodeURIComponent(decodedName);
  } catch {
    // Keep the raw segment to avoid breaking the page on malformed URLs.
  }

  decodedName = decodedName.trim();
  if (!decodedName || INVALID_PROFILE_NAMES.has(decodedName.toLowerCase())) return null;
  return { profileName: decodedName };
}
