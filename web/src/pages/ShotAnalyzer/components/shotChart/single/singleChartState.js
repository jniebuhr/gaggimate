import { createHiddenExternalTooltipState } from '../ShotChartExternalTooltip';
import { INITIAL_VISIBILITY } from '../constants';
import { isStaticMobileTooltipViewport } from '../scrubberUtils';
import { getShotIdentityKey } from '../../../utils/analyzerUtils';

export const HIDDEN_STATIC_TOOLTIP_STATE = createHiddenExternalTooltipState();

function getDefaultSingleChartVisibility() {
  const showContextOverlaysByDefault = !isStaticMobileTooltipViewport();

  return {
    ...INITIAL_VISIBILITY,
    // Keep the first mobile view quiet; persisted user choices still take precedence.
    phaseNames: showContextOverlaysByDefault,
    stops: showContextOverlaysByDefault,
  };
}

export function normalizeSingleChartVisibility(storedVisibility) {
  const defaultVisibility = getDefaultSingleChartVisibility();
  if (!storedVisibility || typeof storedVisibility !== 'object') return defaultVisibility;

  return Object.keys(defaultVisibility).reduce(
    (visibility, key) => ({
      ...visibility,
      [key]:
        typeof storedVisibility[key] === 'boolean' ? storedVisibility[key] : defaultVisibility[key],
    }),
    {},
  );
}

export const EMPTY_SHOT_SAMPLES = Object.freeze([]);

export function getShotChartIdentityKey(shotData, results) {
  return getShotIdentityKey(shotData) || `analysis:${results?.id || results?.name || ''}`;
}

function sampleHasWeightData(sample) {
  const rawWeight = sample?.v ?? sample?.w ?? sample?.weight ?? sample?.m;
  const numericWeight = Number(rawWeight);
  return Number.isFinite(numericWeight) && numericWeight > 0;
}

function sampleHasWeightFlowData(sample) {
  const value = Number(sample?.vf ?? sample?.weight_flow);
  return Number.isFinite(value) && value > 0;
}

export function getShotSampleCapabilities(shotSamples) {
  return {
    hasWeightData: shotSamples.some(sampleHasWeightData),
    hasWeightFlowData: shotSamples.some(sampleHasWeightFlowData),
  };
}

export function hasFiniteScrubValue(scrubXValue) {
  return scrubXValue !== null && scrubXValue !== undefined && Number.isFinite(Number(scrubXValue));
}

export function getClampedScrubXValue(scrubXValue, scrubberMax) {
  return hasFiniteScrubValue(scrubXValue)
    ? Math.min(scrubberMax, Math.max(0, Number(scrubXValue)))
    : 0;
}
