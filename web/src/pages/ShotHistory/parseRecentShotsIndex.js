// Parser for recent.bin — the fixed-capacity rolling buffer of the most
// recent completed shots, purpose-built for the dashboard's Recent Shots
// widget so it never needs to fetch/parse a .slog file.
// Mirrors shot_log_format.h RecentShotsHeader and RecentShotEntry (keep in sync)

const HEADER_SIZE = 16;
const ENTRY_SIZE = 80;
const MAGIC = 0x58444952; // 'RIDX'

const TEMP_SCALE = 10;
const PRESSURE_SCALE = 10;
const FLOW_SCALE = 100;
const WEIGHT_SCALE = 10;

const SHOT_FLAG_COMPLETED = 0x01;
const SHOT_FLAG_HAS_NOTES = 0x04;

function decodeCString(bytes) {
  let end = bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      end = i;
      break;
    }
  }
  return new TextDecoder('utf-8').decode(bytes.subarray(0, end));
}

/**
 * Parse the rolling recent-shots buffer.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Array} Shot objects, most recent first, ready for direct UI use.
 */
export function parseRecentShotsIndex(arrayBuffer) {
  const view = new DataView(arrayBuffer);

  if (view.byteLength < HEADER_SIZE) {
    throw new Error('Recent shots file too small');
  }

  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new Error(`Invalid recent shots magic: 0x${magic.toString(16)}`);
  }

  const capacity = view.getUint8(8);
  const count = view.getUint8(9);
  const head = view.getUint8(10);

  const expectedSize = HEADER_SIZE + capacity * ENTRY_SIZE;
  if (view.byteLength < expectedSize) {
    throw new Error(`Recent shots file truncated: ${view.byteLength} bytes (expected ${expectedSize})`);
  }

  const shots = [];
  const steps = Math.min(count, capacity);
  for (let step = 0; step < steps; step++) {
    const slot = (head - 1 - step + capacity * 2) % capacity;
    const base = HEADER_SIZE + slot * ENTRY_SIZE;

    const id = view.getUint32(base + 0, true);
    if (id === 0) continue; // hole left by a deletion

    const timestamp = view.getUint32(base + 4, true);
    const duration = view.getUint32(base + 8, true);
    const volume = view.getUint16(base + 12, true);
    const rating = view.getUint8(base + 14);
    const flags = view.getUint8(base + 15);
    const avgTempRaw = view.getUint16(base + 16, true);
    const maxPressureRaw = view.getUint16(base + 18, true);
    const avgFlowRaw = view.getUint16(base + 20, true);
    const profileNameBytes = new Uint8Array(arrayBuffer, base + 22, 48);
    const profileName = decodeCString(profileNameBytes);

    shots.push({
      id: id.toString(),
      profile: profileName,
      timestamp,
      duration,
      volume: volume > 0 ? volume / WEIGHT_SCALE : null,
      rating: rating > 0 ? rating : null,
      incomplete: !(flags & SHOT_FLAG_COMPLETED),
      hasNotes: !!(flags & SHOT_FLAG_HAS_NOTES),
      avgTemp: avgTempRaw > 0 ? avgTempRaw / TEMP_SCALE : null,
      maxPressure: maxPressureRaw > 0 ? maxPressureRaw / PRESSURE_SCALE : null,
      avgFlow: avgFlowRaw > 0 ? avgFlowRaw / FLOW_SCALE : null,
    });
  }

  return shots.sort((a, b) => b.timestamp - a.timestamp);
}
