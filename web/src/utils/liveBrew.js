// Client-side validation for the firmware-advertised Live Brew capability.
// No defaults are invented: controls stay unavailable until the firmware supplies limits.
export function liveBrewLimitsAreValid(limits) {
  return (
    Number.isFinite(limits?.minPressure) &&
    Number.isFinite(limits?.maxPressure) &&
    Number.isFinite(limits?.minFlow) &&
    Number.isFinite(limits?.maxFlow) &&
    limits.minPressure >= 0 &&
    limits.maxPressure > limits.minPressure &&
    limits.minFlow >= 0 &&
    limits.maxFlow > limits.minFlow
  );
}

export function clampLiveBrewSetpoint(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max < min)
    return null;
  return Math.min(max, Math.max(min, value));
}

export function liveBrewStartIsSafe({ connected, systemReady, available, limits }) {
  return !!connected && !!systemReady && !!available && liveBrewLimitsAreValid(limits);
}
