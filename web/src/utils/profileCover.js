import { PROFILE_IMAGE_SIZE } from './profileImage.js';

// Fields that never change a profile's cover: identity, per-device state, dose and the picture itself.
const IGNORED_FIELDS = new Set(['id', 'favorite', 'selected', 'dose', 'image']);

const SAMPLES = 48;
const VIEW = 200;
const MAX_PRESSURE = 12;
const MAX_FLOW = 10;
const POWER_PRESSURE = 9; // stand-in pressure for a pump driven at 100 % power
const SMOOTHING = 0.38;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const round1 = n => Math.round(n * 10) / 10;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Sorted keys and rounded numbers, so formatting differences do not change the seed.
function canonical(value, top = false) {
  if (Array.isArray(value)) return value.map(v => canonical(v));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (!(top && IGNORED_FIELDS.has(key))) out[key] = canonical(value[key]);
    }
    return out;
  }
  return typeof value === 'number' ? Math.round(value * 1000) / 1000 : value;
}

// FNV-1a over the canonical JSON: equal profile content gives an equal seed on every machine.
export function profileCoverSeed(profile) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(profile, true)));
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: a small seeded generator, so a seed always yields the same sequence.
function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// OKLCH to an sRGB hex colour; fixed lightness and chroma keep every cover in one family.
function oklch(lightness, chroma, hue) {
  const h = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(h);
  const b = chroma * Math.sin(h);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const hex = linear.map(value => {
    const v = clamp(value, 0, 1);
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${hex.join('')}`;
}

function ease(type, t) {
  switch (type) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    default:
      return 1;
  }
}

// A target of -1 means "keep the value the previous phase ended on".
const targetValue = (next, current) => (next === -1 ? current : Number(next) || 0);

// Samples the pressure and flow targets over the whole profile and smooths them like a real shot.
function sampleProfile(profile) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];
  const segments = [];
  let start = 0;
  let pressure = 0;
  let flow = 0;
  for (const phase of phases) {
    const duration = Math.max(Number(phase.duration) || 0, 0);
    const power = typeof phase.pump === 'number';
    const toPressure = power
      ? (phase.pump / 100) * POWER_PRESSURE
      : targetValue(phase.pump?.pressure, pressure);
    const toFlow = power ? 0 : targetValue(phase.pump?.flow, flow);
    segments.push({
      start,
      end: start + duration,
      fromPressure: pressure,
      fromFlow: flow,
      toPressure,
      toFlow,
      type: phase.transition?.type || 'instant',
      span: Math.min(Number(phase.transition?.duration) || duration, duration),
    });
    start += duration;
    pressure = toPressure;
    flow = toFlow;
  }
  const total = start || 1;
  const targetsAt = time => {
    const segment = segments.find(s => time < s.end) || segments[segments.length - 1];
    if (!segment) return [0, 0];
    const k =
      segment.span > 0 ? ease(segment.type, clamp((time - segment.start) / segment.span, 0, 1)) : 1;
    return [
      segment.fromPressure + (segment.toPressure - segment.fromPressure) * k,
      segment.fromFlow + (segment.toFlow - segment.fromFlow) * k,
    ];
  };
  const pressures = [];
  const flows = [];
  let smoothPressure = 0;
  let smoothFlow = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const [targetPressure, targetFlow] = targetsAt((i / SAMPLES) * total);
    pressures.push(smoothPressure);
    flows.push(smoothFlow);
    smoothPressure += SMOOTHING * (targetPressure - smoothPressure);
    smoothFlow += SMOOTHING * (targetFlow - smoothFlow);
  }
  const marks = segments.slice(0, -1).map(s => round1((s.end / total) * VIEW));
  return { pressures, flows, marks };
}

// The cover as an SVG: the pressure curve as layered ridges, the flow as a line, temperature as the orb.
export function profileCoverSvg(profile) {
  const random = seededRandom(profileCoverSeed(profile));
  const hue = random() * 360;
  const ridgeHue = hue + (random() < 0.5 ? -1 : 1) * (20 + random() * 25);
  const { pressures, flows, marks } = sampleProfile(profile);
  const x = i => round1((i * VIEW) / SAMPLES);
  const pressureY = v => round1(176 - (clamp(v, 0, MAX_PRESSURE) / MAX_PRESSURE) * 118);
  const flowY = v => round1(176 - (clamp(v, 0, MAX_FLOW) / MAX_FLOW) * 118);
  const light = oklch(0.97, 0.02, ridgeHue);

  // The ridge runs past both edges so the shifted back layers leave no gap.
  const ridge = `M-20 200V${pressureY(pressures[0])}${pressures
    .map((v, i) => `L${x(i)} ${pressureY(v)}`)
    .join('')}H220V200Z`;
  const flowLine =
    Math.max(...flows) > 0.2
      ? `<path d="${flows.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${flowY(v)}`).join('')}" fill="none" stroke="${light}" stroke-width="2" stroke-linejoin="round" opacity=".85"/>`
      : '';
  const ticks = marks.length
    ? `<path d="${marks.map(mark => `M${mark} 187v7`).join('')}" stroke="${light}" stroke-width="1.5" opacity=".55"/>`
    : '';
  // Hotter profiles get a higher and bigger orb: 84 °C is the bottom of the range, 96 °C the top.
  const heat = clamp(((Number(profile?.temperature) || 0) - 84) / 12, 0, 1);
  const orb = `<circle cx="${round1(30 + random() * 140)}" cy="${round1(64 - heat * 38)}" r="${round1(9 + heat * 12)}" fill="${oklch(0.9, 0.09, hue + 180)}"/>`;
  // Back ridges lean to opposite sides by seeded amounts; sideways shifts stay within the ridge's 20-unit overhang.
  const lean = random() < 0.5 ? -1 : 1;
  const midRise = 13 + random() * 8;
  const mid = `translate(${round1(lean * (6 + random() * 10))} ${round1(-midRise)})`;
  const back = `translate(${round1(-lean * (10 + random() * 10))} ${round1(-midRise - 13 - random() * 8)})`;

  // Explicit width and height: some browsers cannot draw an SVG without them onto a canvas.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PROFILE_IMAGE_SIZE}" height="${PROFILE_IMAGE_SIZE}" viewBox="0 0 ${VIEW} ${VIEW}">` +
    `<defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${oklch(0.17, 0.04, hue)}"/><stop offset="1" stop-color="${oklch(0.3, 0.08, hue)}"/></linearGradient>` +
    `<linearGradient id="f" x2="0" y2="1"><stop stop-color="${oklch(0.72, 0.15, ridgeHue)}"/><stop offset="1" stop-color="${oklch(0.5, 0.14, ridgeHue + 15)}"/></linearGradient>` +
    `<path id="r" d="${ridge}"/></defs>` +
    `<rect width="${VIEW}" height="${VIEW}" fill="url(#s)"/>${orb}` +
    `<use href="#r" transform="${back}" fill="${oklch(0.36, 0.09, ridgeHue)}"/>` +
    `<use href="#r" transform="${mid}" fill="${oklch(0.5, 0.12, ridgeHue)}"/>` +
    `<use href="#r" fill="url(#f)"/>${flowLine}${ticks}</svg>`
  );
}

// Ordered dither down to RGB565 levels, so gradients show no bands on the 16-bit display.
function ditherToRgb565(ctx) {
  const size = PROFILE_IMAGE_SIZE;
  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  for (let i = 0, n = 0; i < px.length; i += 4, n++) {
    const offset = BAYER[(Math.floor(n / size) & 3) * 4 + (n % size & 3)] / 16 - 0.5;
    const r = clamp(px[i] + offset * 8, 0, 255) >> 3;
    const g = clamp(px[i + 1] + offset * 4, 0, 255) >> 2;
    const b = clamp(px[i + 2] + offset * 8, 0, 255) >> 3;
    px[i] = (r * 255) / 31;
    px[i + 1] = (g * 255) / 63;
    px[i + 2] = (b * 255) / 31;
    px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

// Renders the cover onto a 300x300 canvas that canvasToDeviceImage converts without further loss.
export async function drawProfileCover(profile) {
  const image = new Image();
  image.src = `data:image/svg+xml,${encodeURIComponent(profileCoverSvg(profile))}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = PROFILE_IMAGE_SIZE;
  canvas.height = PROFILE_IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
  ditherToRgb565(ctx);
  return canvas;
}
