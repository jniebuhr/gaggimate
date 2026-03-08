// Shared formatting helpers for Statistics components.

export function fmt(val, digits = 1) {
  return Number.isFinite(val) ? val.toFixed(digits) : '-';
}
