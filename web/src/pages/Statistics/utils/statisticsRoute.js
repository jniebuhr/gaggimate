// Shared route helpers keep Analyzer/ProfileList -> Statistics deep links consistent.
export const VALID_STATISTICS_SOURCES = ['gaggimate', 'browser'];

const SOURCE_ALIAS_TO_SOURCE = {
  internal: 'gaggimate',
  gm: 'gaggimate',
  gaggimate: 'gaggimate',
  external: 'browser',
  web: 'browser',
  browser: 'browser',
};

const SOURCE_TO_ALIAS = {
  gaggimate: 'internal',
  browser: 'external',
};

export const STATISTICS_SOURCE_FALLBACK = {
  gaggimate: 'browser',
  browser: 'gaggimate',
};

const INVALID_PROFILE_NAMES = new Set(['no profile loaded']);

export function mapStatisticsSourceAliasToSource(alias) {
  const normalized = String(alias || '')
    .trim()
    .toLowerCase();
  return SOURCE_ALIAS_TO_SOURCE[normalized] || null;
}

export function mapSourceToStatisticsAlias(source) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();
  return SOURCE_TO_ALIAS[normalized] || null;
}

export function buildStatisticsProfileHref({ source, profileName }) {
  const alias = mapSourceToStatisticsAlias(source);
  const trimmedName = String(profileName || '').trim();
  if (!alias || !trimmedName) return '/statistics';
  if (INVALID_PROFILE_NAMES.has(trimmedName.toLowerCase())) return '/statistics';
  return `/statistics/${alias}/${encodeURIComponent(trimmedName)}`;
}

export function parseStatisticsProfileRouteParams(params) {
  const source = mapStatisticsSourceAliasToSource(params?.sourceAlias);
  const rawProfileParam = params?.profileName;
  if (!source || !rawProfileParam) return null;

  let decodedName = String(rawProfileParam);
  try {
    decodedName = decodeURIComponent(decodedName);
  } catch {
    // Keep the raw segment to avoid breaking the page on malformed URLs.
  }

  decodedName = decodedName.trim();
  if (!decodedName || INVALID_PROFILE_NAMES.has(decodedName.toLowerCase())) return null;

  return {
    source,
    profileName: decodedName,
  };
}
