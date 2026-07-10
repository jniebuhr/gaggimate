export function getPhaseName(shot, phaseNumber) {
  if (shot.phaseTransitions?.length > 0) {
    const transition = shot.phaseTransitions.find(t => t.phaseNumber === phaseNumber);
    if (transition?.phaseName) {
      return transition.phaseName;
    }
  }

  if (shot.profile?.phases?.[phaseNumber]) {
    return shot.profile.phases[phaseNumber].name;
  }

  return phaseNumber === 0 ? 'Start' : `P${phaseNumber + 1}`;
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function safeMax(arr, fallback = 0) {
  let max = -Infinity;
  for (const value of arr) {
    if (value > max) max = value;
  }
  return max === -Infinity ? fallback : max;
}

export function safeMin(arr, fallback = 0) {
  let min = Infinity;
  for (const value of arr) {
    if (value < min) min = value;
  }
  return min === Infinity ? fallback : min;
}

export function findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue) {
  if (!Array.isArray(sampleTimesSec) || sampleTimesSec.length === 0 || !Number.isFinite(xValue)) {
    return -1;
  }
  if (xValue < sampleTimesSec[0]) return -1;

  // Hover, replay, and water lookups all need the latest sample at or before a
  // given x-value, so keep this as a binary search rather than rescanning arrays.
  let low = 0;
  let high = sampleTimesSec.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midValue = sampleTimesSec[mid];
    if (!Number.isFinite(midValue)) {
      high = mid - 1;
      continue;
    }
    if (midValue <= xValue) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
