import {
  CHART_COLOR_FALLBACKS,
  CHART_COLOR_TOKEN_MAP,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from '../constants';

export function readCssColorVar(variableName, fallback) {
  const rootElement = globalThis.window?.document?.documentElement;
  if (rootElement) {
    const value = globalThis.window
      .getComputedStyle(rootElement)
      .getPropertyValue(variableName)
      .trim();
    return value || fallback;
  }
  return fallback;
}

export function getShotChartColors() {
  // Resolve all chart colors from CSS variables in one place so the rest of the
  // chart stack can work with concrete values instead of repeatedly touching the DOM.
  return Object.keys(CHART_COLOR_FALLBACKS).reduce((acc, key) => {
    acc[key] = readCssColorVar(CHART_COLOR_TOKEN_MAP[key], CHART_COLOR_FALLBACKS[key]);
    return acc;
  }, {});
}

export function getLegendColorByLabel(colors) {
  return {
    Phases: colors.phaseLine,
    Stops: colors.stopLabel,
    Temp: colors.temp,
    'Target T': colors.tempTarget,
    Pressure: colors.pressure,
    'Target P': colors.pressure,
    'Pump Flow': colors.flow,
    'Target F': colors.flow,
    'Puck Flow': colors.puckFlow,
    Weight: colors.weight,
    'Weight Flow': colors.weightFlow,
  };
}

export function getTooltipColorByLabel(colors) {
  return {
    ...getLegendColorByLabel(colors),
    [WATER_DRAWN_PHASE_LABEL]: 'color-mix(in srgb, var(--statistics-summary-water) 84%, black)',
    [WATER_DRAWN_TOTAL_LABEL]: 'var(--statistics-summary-water)',
  };
}

export function createStripedFillPattern(canvasCtx, color, options = {}) {
  if (!canvasCtx || globalThis.window === undefined) return color;

  const size = options.size ?? 8;
  const lineWidth = options.lineWidth ?? 1;
  const baseAlpha = options.baseAlpha ?? 0.02;
  const stripeAlpha = options.stripeAlpha ?? 0.1;

  const patternCanvas = globalThis.window.document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;

  const patternCtx = patternCanvas.getContext('2d');
  if (!patternCtx) return color;

  // Use a tiny offscreen canvas so fills can share one repeatable striped pattern
  // without depending on large gradient objects or per-point drawing.
  patternCtx.clearRect(0, 0, size, size);
  patternCtx.fillStyle = color;
  patternCtx.globalAlpha = baseAlpha;
  patternCtx.fillRect(0, 0, size, size);

  patternCtx.strokeStyle = color;
  patternCtx.globalAlpha = stripeAlpha;
  patternCtx.lineWidth = lineWidth;
  patternCtx.lineCap = 'butt';
  patternCtx.beginPath();
  patternCtx.moveTo(0, size);
  patternCtx.lineTo(size, 0);
  patternCtx.stroke();

  return canvasCtx.createPattern(patternCanvas, 'repeat') || color;
}
