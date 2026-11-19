// Optional grinder values of a profile; empty inputs drop the key so the grinder keeps its own setting.
export function updateGrinderSettings(grinder, field, rawValue) {
  const next = { ...(grinder || {}) };
  const value = rawValue === '' ? NaN : Number(rawValue);
  if (Number.isFinite(value) && value >= 0) {
    next[field] = value;
  } else {
    delete next[field];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
