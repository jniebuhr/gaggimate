export const DEFAULT_REMOTE_PAGES_ORIGIN = 'https://carloshrdezc.github.io/gaggimate';

export function buildRemoteAccessLink({
  relayEnabled,
  relayUrl = '',
  relayToken = '',
  pagesOrigin = DEFAULT_REMOTE_PAGES_ORIGIN,
}) {
  if (!relayEnabled || !relayUrl || !relayToken) return null;
  return `${pagesOrigin}?relay=${encodeURIComponent(relayUrl)}&token=${encodeURIComponent(relayToken)}`;
}
