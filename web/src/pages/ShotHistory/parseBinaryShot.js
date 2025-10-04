// Parser for .slog binary shot files
// Mirrors shot_log_format.h (keep in sync)
// Header: 128 bytes
// Strict single format (no backward compatibility)

const HEADER_SIZE = 128;
const SAMPLE_SIZE = 24; // 12 packed 16-bit values
const MAGIC = 0x544f4853; // 'SHOT'

const TEMP_SCALE = 10;
const PRESSURE_SCALE = 10;
const FLOW_SCALE = 100;
const WEIGHT_SCALE = 10;
const RESISTANCE_SCALE = 100;

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
  if (dataBytes < 0) {
    throw new Error('Data size misaligned');
  }
  const fullSampleBytes = Math.floor(dataBytes / SAMPLE_SIZE) * SAMPLE_SIZE;
  const trailingBytes = dataBytes - fullSampleBytes;
  const inferredSamples = fullSampleBytes / SAMPLE_SIZE;
  const maxSamples = sampleCountHeader
    ? Math.min(sampleCountHeader, inferredSamples)
    : inferredSamples;
  for (let i = 0; i < maxSamples; i++) {
    const base = headerSize + i * SAMPLE_SIZE;
    const tick = view.getUint16(base + 0, true);
    const t = tick * sampleInterval;
    const tt = view.getUint16(base + 2, true) / TEMP_SCALE;
    const ct = view.getUint16(base + 4, true) / TEMP_SCALE;
    const tp = view.getUint16(base + 6, true) / PRESSURE_SCALE;
    const cp = view.getUint16(base + 8, true) / PRESSURE_SCALE;
    const fl = view.getInt16(base + 10, true) / FLOW_SCALE;
    const tf = view.getInt16(base + 12, true) / FLOW_SCALE;
    const pf = view.getInt16(base + 14, true) / FLOW_SCALE;
    const vf = view.getInt16(base + 16, true) / FLOW_SCALE;
    const v = view.getUint16(base + 18, true) / WEIGHT_SCALE;
    const ev = view.getUint16(base + 20, true) / WEIGHT_SCALE;
    const pr = view.getUint16(base + 22, true) / RESISTANCE_SCALE;
    samples.push({ t, tt, ct, tp, cp, fl, tf, pf, vf, v, ev, pr });
  }

  const lastT = samples.length ? samples[samples.length - 1].t : 0;
  const headerIncomplete = sampleCountHeader === 0;
  const inferredIncomplete =
    trailingBytes !== 0 || (sampleCountHeader && sampleCountHeader > inferredSamples);
  const incomplete = headerIncomplete || inferredIncomplete;
  const effectiveDuration = !incomplete && durationHeader ? durationHeader : lastT;

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
    trailingBytes,
    samplesExpected: sampleCountHeader,
  };
}
