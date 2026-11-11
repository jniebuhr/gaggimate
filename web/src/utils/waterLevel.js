// Water tank calibration helpers. Kept free of Lingui and DOM so they can be unit tested.

// Distances are stored by the firmware as whole millimetres; 0 is valid (e.g. a full tank right at the sensor).
export function parseTankDistance(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Per-field error codes: 'invalid' (blank, non-numeric, negative, fractional) or 'order' (empty must exceed full).
export function validateTankCalibration(emptyDistance, fullDistance) {
  const empty = parseTankDistance(emptyDistance);
  const full = parseTankDistance(fullDistance);
  return {
    empty: empty === null ? 'invalid' : full !== null && empty <= full ? 'order' : null,
    full: full === null ? 'invalid' : null,
  };
}

// Returns 0-100, or null when the calibration or the reading can't produce a level.
export function computeWaterLevel({ empty, full, distance }) {
  const errors = validateTankCalibration(empty, full);
  if (errors.empty || errors.full) return null;
  if (typeof distance !== 'number' || !Number.isFinite(distance)) return null;
  const emptyMm = parseTankDistance(empty);
  const fullMm = parseTankDistance(full);
  const percent = ((emptyMm - distance) / (emptyMm - fullMm)) * 100;
  return Math.max(0, Math.min(100, percent));
}
