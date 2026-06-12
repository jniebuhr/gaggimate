export function getProfilePhases(data) {
  return Array.isArray(data?.phases) ? data.phases : [];
}

export function updatePhaseAt(phases, index, value) {
  const next = [...phases];
  next[index] = value;
  return next;
}

export function removePhaseAt(phases, index) {
  return phases.filter((_, i) => i !== index);
}
