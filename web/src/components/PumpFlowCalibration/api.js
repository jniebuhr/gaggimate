// HTTP helpers used by the calibration flow. Wrap the firmware endpoints so
// the hook deals with parsed shots and typed errors, not fetch plumbing.

import { parseBinaryIndex } from '../../pages/ShotHistory/parseBinaryIndex.js';
import { parseBinaryShot } from '../../pages/ShotHistory/parseBinaryShot.js';
import { SLOG_FETCH_DELAY_MS, SLOG_FETCH_RETRIES } from './constants.js';

const SHOT_FLAG_DELETED = 0x02;
const SLOG_HEADER_V4 = 128;
const SLOG_HEADER_V5 = 512;

// A `.slog` is ready once the firmware has flushed both the header AND at
// least one sample byte past it. The header size depends on the version byte
// (offset 4): v≤4 = 128 B, v≥5 = 512 B. The previous fixed 128 B check would
// have accepted an empty (header-only) v5 file and parsed it as 0 samples.
function isSlogReady(buf) {
  if (buf.byteLength < 16) return false;
  const version = new DataView(buf).getUint8(4);
  const headerSize = version <= 4 ? SLOG_HEADER_V4 : SLOG_HEADER_V5;
  return buf.byteLength > headerSize;
}

export async function fetchShotIndex() {
  const r = await fetch('/api/history/index.bin', { cache: 'no-store' });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GET index.bin ${r.status}`);
  const buf = await r.arrayBuffer();
  return parseBinaryIndex(buf).entries.filter(e => !(e.flags & SHOT_FLAG_DELETED));
}

// Retries until the firmware has flushed the .slog header to flash. The
// firmware can return 404 while the file is still being created — treat that
// (and a too-short response body) as "not ready yet" and keep polling.
async function fetchShotReady(id, onWait) {
  const padded = String(id).padStart(6, '0');
  for (let attempt = 1; attempt <= SLOG_FETCH_RETRIES; attempt++) {
    const r = await fetch(`/api/history/${padded}.slog`, { cache: 'no-store' });
    if (r.ok) {
      const buf = await r.arrayBuffer();
      if (isSlogReady(buf)) return buf;
    } else if (r.status !== 404) {
      throw new Error(`GET slog ${r.status}`);
    }
    if (onWait && (attempt === 1 || attempt % 3 === 0)) {
      onWait(`slog not ready, waiting for flush... (${attempt})`);
    }
    if (attempt === SLOG_FETCH_RETRIES) break;
    await new Promise(res => setTimeout(res, SLOG_FETCH_DELAY_MS));
  }
  throw new Error(
    `Shot file remained empty after ${(SLOG_FETCH_RETRIES * SLOG_FETCH_DELAY_MS) / 1000}s`,
  );
}

export async function fetchAndParseShot(id, onWait) {
  const buf = await fetchShotReady(id, onWait);
  return parseBinaryShot(buf, String(id));
}

export async function postCoefficients(coeffs) {
  const body = new URLSearchParams({ pumpModelCoeffs: coeffs }).toString();
  const r = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`POST /api/settings ${r.status}`);
}
