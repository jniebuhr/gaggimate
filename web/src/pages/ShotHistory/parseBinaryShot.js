// Parser for .slog binary shot files
// Mirrors shot_log_format.h (keep in sync)
// Header: 128 bytes
// Strict single format (no backward compatibility)

const HEADER_SIZE = 128;
const SAMPLE_SIZE = 48; // uint32 + 11 floats
const MAGIC = 0x544F4853; // 'SHOT'

function decodeCString(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) break;
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function parseBinaryShot(arrayBuffer, id) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < HEADER_SIZE) throw new Error('File too small');
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) throw new Error('Bad magic');
  const version = view.getUint8(4);
  const deviceSampleSize = view.getUint8(5); // reserved0 holds sample size
  const headerSize = view.getUint16(6, true);
  const sampleInterval = view.getUint16(8, true);
  const fieldsMask = view.getUint32(12, true);
  const sampleCountHeader = view.getUint32(16, true);
  const durationHeader = view.getUint32(20, true);
  const startEpoch = view.getUint32(24, true);
  const profileIdBytes = new Uint8Array(arrayBuffer, 28, 32);
  const profileNameBytes = new Uint8Array(arrayBuffer, 60, 48);
  const profileId = decodeCString(profileIdBytes);
  const profileName = decodeCString(profileNameBytes);

  if (deviceSampleSize !== SAMPLE_SIZE) {
    throw new Error(`Unsupported sample size ${deviceSampleSize} (expected ${SAMPLE_SIZE})`);
  }
  if (headerSize !== HEADER_SIZE) throw new Error('Unexpected header size');

  const samples = [];
  const dataBytes = view.byteLength - headerSize;
  if (dataBytes < 0 || dataBytes % SAMPLE_SIZE !== 0) {
    throw new Error('Data size misaligned');
  }
  const inferredSamples = dataBytes / SAMPLE_SIZE;
  const maxSamples = sampleCountHeader ? Math.min(sampleCountHeader, inferredSamples) : inferredSamples;
  for (let i = 0; i < maxSamples; i++) {
    const base = headerSize + i * SAMPLE_SIZE;
    const t = view.getUint32(base + 0, true);
    const tt = view.getFloat32(base + 4, true);
    const ct = view.getFloat32(base + 8, true);
    const tp = view.getFloat32(base + 12, true);
    const cp = view.getFloat32(base + 16, true);
    const fl = view.getFloat32(base + 20, true);
    const tf = view.getFloat32(base + 24, true);
    const pf = view.getFloat32(base + 28, true);
    const vf = view.getFloat32(base + 32, true);
    const v = view.getFloat32(base + 36, true);
    const ev = view.getFloat32(base + 40, true);
    const pr = view.getFloat32(base + 44, true);
    samples.push({ t, tt, ct, tp, cp, fl, tf, pf, vf, v, ev, pr });
  }

  const lastT = samples.length ? samples[samples.length - 1].t : 0;
  const effectiveDuration = durationHeader || lastT;
  const incomplete = sampleCountHeader === 0;

  return {
    id,
    version,
    profile: profileName,
    profileId,
    timestamp: startEpoch,
    duration: effectiveDuration,
    samples,
    volume: samples.length ? samples[samples.length - 1].v : 0,
    incomplete,
    sampleInterval,
    fieldsMask,
  };
}
