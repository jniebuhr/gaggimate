/**
 * ShotChart.jsx
 * Chart.js visualization component for shot data.
 * Main chart: pressure/flow family + weight + annotations.
 * Sub chart: temperature (Temp + Target T).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMaximize } from '@fortawesome/free-solid-svg-icons/faMaximize';
import { faMinimize } from '@fortawesome/free-solid-svg-icons/faMinimize';

// Register the annotation plugin for Phase Lines
Chart.register(annotationPlugin);

const hoverGuidePlugin = {
  id: 'hoverGuide',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const active = chart.getActiveElements?.() || chart.tooltip?.getActiveElements?.() || [];
    if (!active.length) return;

    const x = active[0]?.element?.x;
    if (!Number.isFinite(x)) return;

    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = pluginOptions?.color || 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = pluginOptions?.lineWidth || 1;
    ctx.setLineDash(pluginOptions?.dash || [3, 3]);
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

const fixedTooltipPlugin = {
  id: 'fixedTooltip',
  beforeTooltipDraw(chart, args, pluginOptions) {
    const tooltip = args.tooltip;
    if (!tooltip || tooltip.opacity === 0 || !chart.chartArea) return;

    const offsetX = pluginOptions?.offsetX ?? 12;
    const offsetY = pluginOptions?.offsetY ?? 12;
    const boundsPadding = pluginOptions?.boundsPadding ?? 4;
    const pointerGap = pluginOptions?.pointerGap ?? 10;
    const tooltipWidth = Number(tooltip.width) || 0;
    const tooltipHeight = Number(tooltip.height) || 0;

    const anchorX = Number.isFinite(tooltip.caretX) ? tooltip.caretX : chart.chartArea.left + offsetX;
    const chartMidX = (chart.chartArea.left + chart.chartArea.right) / 2;
    const showRightOfPointer = anchorX <= chartMidX;
    const preferredX = showRightOfPointer
      ? anchorX + pointerGap
      : anchorX - tooltipWidth - pointerGap;
    const anchorY = Number.isFinite(chart.$fixedTooltipPointerY)
      ? chart.$fixedTooltipPointerY
      : Number.isFinite(tooltip.caretY)
        ? tooltip.caretY
        : chart.chartArea.top + offsetY;
    const preferredY = anchorY - tooltipHeight / 2 + offsetY;
    const maxX = Math.max(boundsPadding, chart.width - tooltipWidth - boundsPadding);
    const maxY = Math.max(boundsPadding, chart.height - tooltipHeight - boundsPadding);
    const fixedX = Math.min(maxX, Math.max(boundsPadding, preferredX));
    const fixedY = Math.min(maxY, Math.max(boundsPadding, preferredY));

    tooltip.x = fixedX;
    tooltip.y = fixedY;
    tooltip.caretX = anchorX;
    tooltip.caretY = anchorY;
    tooltip.xAlign = 'left';
    tooltip.yAlign = 'top';
  },
};

const TARGET_FLOW_MAX = 12;
const TARGET_PRESSURE_MAX = 16;
const STANDARD_LINE_WIDTH = 4;
const THIN_LINE_WIDTH = STANDARD_LINE_WIDTH / 2;
const BREW_BY_TIME_LABEL = 'BREW BY TIME';
const BREW_BY_WEIGHT_LABEL = 'BREW BY WEIGHT';
const MAIN_CHART_HEIGHT_SMALL = 280;
const MAIN_CHART_HEIGHT_BIG = 560;
const MAIN_CHART_HEIGHT_DEFAULT = MAIN_CHART_HEIGHT_SMALL;
const TEMP_CHART_HEIGHT_RATIO = 80 / MAIN_CHART_HEIGHT_SMALL;
const CHART_COLOR_FALLBACKS = {
  temp: '#F0561D',
  tempTarget: '#731F00',
  pressure: '#0066CC',
  flow: '#63993D',
  puckFlow: '#059669',
  weight: '#8B5CF6',
  phaseLine: 'rgba(107, 114, 128, 0.5)',
  stopLabel: 'rgba(220, 38, 38, 0.85)',
};
const CHART_COLOR_TOKEN_MAP = {
  temp: '--analyzer-temp-anchor',
  tempTarget: '--analyzer-target-temp-anchor',
  pressure: '--analyzer-pressure-anchor',
  flow: '--analyzer-flow-anchor',
  puckFlow: '--analyzer-puckflow-anchor',
  weight: '--analyzer-weight-anchor',
  phaseLine: '--analyzer-phase-line',
  stopLabel: '--analyzer-stop-label',
};
const LEGEND_BLOCK_LABELS = new Set(['Phase Names', 'Stops']);
const LEGEND_DASHED_LABELS = new Set(['Target T', 'Target P', 'Target F']);
const LEGEND_THIN_LINE_LABELS = new Set(['Target T', 'Target P', 'Target F', 'Puck Flow', 'Weight']);
const WATER_DRAWN_PHASE_LABEL = 'Water Drawn (Phase)';
const WATER_DRAWN_TOTAL_LABEL = 'Water Drawn (Total)';
const TOOLTIP_WATER_LABELS = new Set([WATER_DRAWN_PHASE_LABEL, WATER_DRAWN_TOTAL_LABEL]);
const TOOLTIP_BOTTOM_LABELS = new Set(['Temp', 'Target T']);

const LEGEND_ORDER = [
  'Phase Names',
  'Stops',
  'Pressure',
  'Target P',
  'Flow',
  'Target F',
  'Puck Flow',
  'Weight',
  'Temp',
  'Target T',
];

const LEGEND_INDEX = LEGEND_ORDER.reduce((acc, label, index) => {
  acc[label] = index;
  return acc;
}, {});
const TOOLTIP_ORDER = [
  'Phase Names',
  'Stops',
  'Pressure',
  'Target P',
  'Flow',
  'Target F',
  'Puck Flow',
  'Weight',
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
  'Temp',
  'Target T',
];
const TOOLTIP_INDEX = TOOLTIP_ORDER.reduce((acc, label, index) => {
  acc[label] = index;
  return acc;
}, {});

const VISIBILITY_KEY_BY_LABEL = {
  'Phase Names': 'phaseNames',
  Stops: 'stops',
  Temp: 'temp',
  'Target T': 'targetTemp',
  Pressure: 'pressure',
  'Target P': 'targetPressure',
  Flow: 'flow',
  'Target F': 'targetFlow',
  'Puck Flow': 'puckFlow',
  Weight: 'weight',
};

const INITIAL_VISIBILITY = {
  phaseNames: true,
  stops: true,
  temp: true,
  targetTemp: true,
  pressure: true,
  targetPressure: true,
  flow: true,
  targetFlow: true,
  puckFlow: true,
  weight: true,
};

function readCssColorVar(variableName, fallback) {
  if (typeof window === 'undefined' || !window.document?.documentElement) return fallback;
  const value = window
    .getComputedStyle(window.document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

function getShotChartColors() {
  return Object.keys(CHART_COLOR_FALLBACKS).reduce((acc, key) => {
    acc[key] = readCssColorVar(CHART_COLOR_TOKEN_MAP[key], CHART_COLOR_FALLBACKS[key]);
    return acc;
  }, {});
}

function getLegendColorByLabel(colors) {
  return {
    'Phase Names': colors.phaseLine,
    Stops: colors.stopLabel,
    Temp: colors.temp,
    'Target T': colors.tempTarget,
    Pressure: colors.pressure,
    'Target P': colors.pressure,
    Flow: colors.flow,
    'Target F': colors.flow,
    'Puck Flow': colors.puckFlow,
    Weight: colors.weight,
  };
}

const UNIT_BY_LABEL = {
  Temp: '°C',
  'Target T': '°C',
  Pressure: 'bar',
  'Target P': 'bar',
  Flow: 'ml/s',
  'Target F': 'ml/s',
  'Puck Flow': 'ml/s',
  Weight: 'g',
  [WATER_DRAWN_PHASE_LABEL]: 'ml',
  [WATER_DRAWN_TOTAL_LABEL]: 'ml',
};

// --- Helper Functions ---

/**
 * Retrieves the phase name for a specific phase number.
 * @param {Object} shot - The shot data object.
 * @param {number} phaseNumber - The index of the phase.
 * @returns {string} The name of the phase or a fallback name.
 */
function getPhaseName(shot, phaseNumber) {
  // 1. Try to find the name in the logged phase transitions
  if (shot.phaseTransitions && shot.phaseTransitions.length > 0) {
    const transition = shot.phaseTransitions.find(t => t.phaseNumber === phaseNumber);
    if (transition && transition.phaseName) {
      return transition.phaseName;
    }
  }

  // 2. Fallback: Try to get it from the original profile definition if embedded
  if (shot.profile && shot.profile.phases && shot.profile.phases[phaseNumber]) {
    return shot.profile.phases[phaseNumber].name;
  }

  // 3. Fallback to guarantee a label is rendered
  return phaseNumber === 0 ? 'Start' : `P${phaseNumber + 1}`;
}

/**
 * Converts a candidate value to a finite number or null.
 * @param {any} value - Candidate input value.
 * @returns {number|null}
 */
function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatAxisTick(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const rounded = Math.round(numeric);
  const absolute = Math.abs(rounded).toString().padStart(2, '0');
  return rounded < 0 ? `-${absolute}` : absolute;
}

function createStripedFillPattern(canvasCtx, color, options = {}) {
  if (!canvasCtx || typeof window === 'undefined') return color;

  const size = options.size ?? 8;
  const lineWidth = options.lineWidth ?? 1;
  const baseAlpha = options.baseAlpha ?? 0.02;
  const stripeAlpha = options.stripeAlpha ?? 0.1;

  const patternCanvas = window.document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;

  const patternCtx = patternCanvas.getContext('2d');
  if (!patternCtx) return color;

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

function safeMax(arr, fallback = 0) {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max === -Infinity ? fallback : max;
}

function safeMin(arr, fallback = 0) {
  let min = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min === Infinity ? fallback : min;
}

function findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue) {
  if (!Array.isArray(sampleTimesSec) || sampleTimesSec.length === 0 || !Number.isFinite(xValue)) {
    return -1;
  }
  if (xValue < sampleTimesSec[0]) return -1;

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

/**
 * ShotChart Component
 * Renders main and sub chart using Chart.js.
 */
export function ShotChart({ shotData, results }) {
  const hoverAreaRef = useRef(null);
  const mainChartRef = useRef(null);
  const tempChartRef = useRef(null);
  const mainChartInstance = useRef(null);
  const tempChartInstance = useRef(null);

  // --- State for Visibility/Toggles ---
  const [visibility, setVisibility] = useState(INITIAL_VISIBILITY);
  const [mainChartHeight, setMainChartHeight] = useState(MAIN_CHART_HEIGHT_DEFAULT);
  const legendColorByLabel = getLegendColorByLabel(getShotChartColors());
  const hasWeightData = Boolean(
    shotData?.samples?.some(sample => {
      const rawWeight = sample?.v ?? sample?.w ?? sample?.weight ?? sample?.m;
      const numericWeight = Number(rawWeight);
      return Number.isFinite(numericWeight) && numericWeight > 0;
    }),
  );

  const handleLegendToggle = label => {
    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const destroyCharts = () => {
      if (mainChartInstance.current) {
        mainChartInstance.current.destroy();
        mainChartInstance.current = null;
      }
      if (tempChartInstance.current) {
        tempChartInstance.current.destroy();
        tempChartInstance.current = null;
      }
    };

    // Validation: Ensure data exists before rendering
    if (!shotData || !shotData.samples || shotData.samples.length === 0) {
      destroyCharts();
      return;
    }

    // Cleanup before rebuild to avoid memory leaks/visual glitches
    destroyCharts();

    // Guard: ensure canvas elements are mounted
    if (!mainChartRef.current || !tempChartRef.current) return;

    const COLORS = getShotChartColors();

    const mainCanvasCtx = mainChartRef.current.getContext('2d');
    const targetPressureFill = createStripedFillPattern(mainCanvasCtx, COLORS.pressure, {
      baseAlpha: 0.018,
      stripeAlpha: 0.065,
      size: 18,
      lineWidth: 2,
    });
    const targetFlowFill = createStripedFillPattern(mainCanvasCtx, COLORS.flow, {
      baseAlpha: 0.018,
      stripeAlpha: 0.065,
      size: 18,
      lineWidth: 2,
    });
    const tempCanvasCtx = tempChartRef.current.getContext('2d');
    const tempToTargetFill = createStripedFillPattern(tempCanvasCtx, COLORS.temp, {
      baseAlpha: 0.018,
      stripeAlpha: 0.09,
      size: 9,
      lineWidth: 1,
    });
    const brewModeLabel = results?.isBrewByWeight ? BREW_BY_WEIGHT_LABEL : BREW_BY_TIME_LABEL;
    const brewModeColor = results?.isBrewByWeight
      ? readCssColorVar('--analyzer-brew-by-weight-label-bg', COLORS.weight)
      : readCssColorVar('--analyzer-brew-by-time-label-bg', '#475569');
    const brewModeLabelTextColor = results?.isBrewByWeight
      ? readCssColorVar('--analyzer-brew-by-weight-label-text', '#ffffff')
      : readCssColorVar('--analyzer-brew-by-time-label-text', '#ffffff');
    const brewModeBorderColor = results?.isBrewByWeight
      ? readCssColorVar('--analyzer-brew-by-weight-label-border', COLORS.weight)
      : readCssColorVar('--analyzer-brew-by-time-label-border', '#334155');

    const samples = shotData.samples;

    // Calculate the exact end time of the shot to prevent empty chart space
    const maxTime = samples.length > 0 ? (samples[samples.length - 1].t || 0) / 1000 : 0;
    const sampleTimesSec = new Array(samples.length);
    const cumulativeWaterTotalBySample = new Array(samples.length);
    let cumulativeWaterTotal = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] || {};
      const tMs = Number(sample.t) || 0;
      sampleTimesSec[i] = tMs / 1000;
      if (i === 0) {
        cumulativeWaterTotalBySample[i] = 0;
        continue;
      }

      const prevTMs = Number(samples[i - 1]?.t) || tMs;
      const dt = Math.max(0, (tMs - prevTMs) / 1000);
      const flow = Number(sample.fl);
      cumulativeWaterTotal += (Number.isFinite(flow) ? flow : 0) * dt;
      cumulativeWaterTotalBySample[i] = cumulativeWaterTotal;
    }

    const shotStartSec = sampleTimesSec[0] ?? 0;
    const phaseHoverRanges = Array.isArray(results?.phases)
      ? results.phases
          .map(phase => {
            const startRel = Number(phase?.start);
            if (!Number.isFinite(startRel)) return null;
            const endRelRaw = Number(phase?.end);
            const endRel = Number.isFinite(endRelRaw) ? endRelRaw : startRel;
            const startAbs = shotStartSec + startRel;
            const endAbs = shotStartSec + Math.max(startRel, endRel);
            const startSampleIndexFloor = findLastSampleIndexAtOrBeforeX(sampleTimesSec, startAbs);
            const startCumWater =
              startSampleIndexFloor >= 0 ? cumulativeWaterTotalBySample[startSampleIndexFloor] || 0 : 0;
            return {
              label: phase?.displayName || phase?.name || null,
              startAbs,
              endAbs,
              startSampleIndexFloor,
              startCumWater,
            };
          })
          .filter(Boolean)
      : [];

    // Helper to safely extract values from sample objects
    const getVal = (item, keys) => {
      for (const key of keys) {
        if (item[key] !== undefined) return item[key];
      }
      return null;
    };

    // Initialize data series arrays
    const series = {
      pressure: [],
      flow: [],
      puckFlow: [],
      temp: [],
      weight: [],
      targetPressure: [],
      targetFlow: [],
      targetTemp: [],
    };

    // Parse samples into series
    samples.forEach(sample => {
      const t = (sample.t || 0) / 1000;

      // Extract raw values
      const pressure = toNumberOrNull(getVal(sample, ['cp', 'p', 'pressure']));
      const flow = toNumberOrNull(getVal(sample, ['fl', 'f', 'flow']));
      const puckFlow = toNumberOrNull(getVal(sample, ['pf', 'puck_flow']));
      const temp = toNumberOrNull(getVal(sample, ['ct', 't', 'temperature']));
      const weight = toNumberOrNull(getVal(sample, ['v', 'w', 'weight', 'm']));

      // Extract target values
      const targetPressure = toNumberOrNull(getVal(sample, ['tp', 'target_pressure']));
      const targetFlow = toNumberOrNull(getVal(sample, ['tf', 'target_flow']));
      const targetTemp = toNumberOrNull(getVal(sample, ['tt', 'tr', 'target_temperature']));

      // Populate series
      if (pressure !== null) series.pressure.push({ x: t, y: pressure });
      if (flow !== null) series.flow.push({ x: t, y: flow });
      if (puckFlow !== null) series.puckFlow.push({ x: t, y: puckFlow });
      if (temp !== null) series.temp.push({ x: t, y: temp });
      if (weight !== null && weight >= 0) series.weight.push({ x: t, y: weight });

      if (targetPressure !== null) {
        series.targetPressure.push({ x: t, y: Math.min(targetPressure, TARGET_PRESSURE_MAX) });
      }
      if (targetFlow !== null) {
        series.targetFlow.push({ x: t, y: Math.min(targetFlow, TARGET_FLOW_MAX) });
      }
      if (targetTemp !== null) series.targetTemp.push({ x: t, y: targetTemp });
    });

    const hasWeight = series.weight.some(pt => pt.y > 0);

    // Main-axis range is intentionally derived only from pressure/flow family.
    const mainAxisSamples = [
      ...series.pressure,
      ...series.targetPressure,
      ...series.flow,
      ...series.puckFlow,
      ...series.targetFlow,
    ];
    const mainAxisMaxRaw = safeMax(mainAxisSamples.map(p => p.y), 1);
    const mainAxisMax = Math.max(1, mainAxisMaxRaw * 1.02);

    const weightAxisMaxRaw = safeMax(series.weight.map(p => p.y), 1);
    // Keep weight always visible while keeping headroom minimal like the main axis.
    const weightAxisMax = Math.max(1, weightAxisMaxRaw * 1.02);

    const tempAxisSamples = [...series.temp, ...series.targetTemp];
    const tempMinRaw = safeMin(tempAxisSamples.map(p => p.y), 80);
    const tempMaxRaw = safeMax(tempAxisSamples.map(p => p.y), 100);
    const tempRange = Math.max(0.5, tempMaxRaw - tempMinRaw);
    const tempTopPadding = Math.max(0.15, tempRange * 0.02);
    const tempBottomPadding = Math.max(0.25, tempRange * 0.07);
    const tempAxisMin = tempMinRaw - tempBottomPadding;
    const tempAxisMax = tempMaxRaw + tempTopPadding;

    const targetTempAxisSamples = series.targetTemp.length > 0 ? series.targetTemp : series.temp;
    const targetTempMinRaw = safeMin(targetTempAxisSamples.map(p => p.y), tempMinRaw);
    const targetTempMaxRaw = safeMax(targetTempAxisSamples.map(p => p.y), tempMaxRaw);
    const targetTempRange = Math.max(0.5, targetTempMaxRaw - targetTempMinRaw);
    const targetTempTopPadding = Math.max(0.15, targetTempRange * 0.02);
    const targetTempBottomPadding = Math.max(0.25, targetTempRange * 0.07);
    const targetTempAxisMin = targetTempMinRaw - targetTempBottomPadding;
    const targetTempAxisMax = targetTempMaxRaw + targetTempTopPadding;

    // --- Phase Annotation Logic ---
    const phaseAnnotations = {};
    if (shotData.phaseTransitions && shotData.phaseTransitions.length > 0) {
      if (samples.length > 0) {
        const shotStartTime = (samples[0].t || 0) / 1000;
        phaseAnnotations.shot_start = {
          type: 'line',
          scaleID: 'x',
          value: shotStartTime,
          borderColor: COLORS.phaseLine,
          borderWidth: 1,
          label: {
            display: visibility.phaseNames,
            content: getPhaseName(shotData, 0),
            rotation: -90,
            position: 'start',
            yAdjust: 0,
            xAdjust: 12,
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 3,
            padding: 4,
            font: { size: 9 },
          },
        };
      }

      shotData.phaseTransitions.forEach((transition, index) => {
        let timeInSeconds = 0;
        if (transition.sampleIndex !== undefined && samples[transition.sampleIndex]) {
          timeInSeconds = (samples[transition.sampleIndex].t || 0) / 1000;
        } else if (transition.sampleIndex !== undefined) {
          timeInSeconds = (transition.sampleIndex * (shotData.sampleInterval || 250)) / 1000;
        }

        if (timeInSeconds <= 0.1 && index === 0) return;

        phaseAnnotations[`phase_line_${index}`] = {
          type: 'line',
          scaleID: 'x',
          value: timeInSeconds,
          borderColor: COLORS.phaseLine,
          borderWidth: 1,
          label: {
            display: visibility.phaseNames,
            content: transition.phaseName || `P${transition.phaseNumber + 1}`,
            rotation: -90,
            position: 'start',
            yAdjust: 0,
            xAdjust: 12,
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 3,
            padding: 4,
            font: { size: 9 },
          },
        };

        if (results && results.phases && index > 0) {
          const previousPhaseNumber = shotData.phaseTransitions[index - 1].phaseNumber;
          const endedPhase = results.phases.find(
            p => String(p.number) === String(previousPhaseNumber),
          );

          if (endedPhase && endedPhase.exit && endedPhase.exit.reason) {
            phaseAnnotations[`phase_exit_${index}`] = {
              type: 'line',
              scaleID: 'x',
              value: timeInSeconds,
              borderColor: 'transparent',
              borderWidth: 0,
              label: {
                display: visibility.stops,
                content: endedPhase.exit.reason.toUpperCase(),
                rotation: -90,
                position: 'start',
                yAdjust: 0,
                xAdjust: -12,
                color: 'rgba(255, 255, 255, 0.95)',
                backgroundColor: COLORS.stopLabel,
                borderRadius: 3,
                padding: 4,
                font: { size: 8, weight: 'bold' },
              },
            };
          }
        }
      });

      if (results && results.phases && results.phases.length > 0 && maxTime > 0) {
        const lastPhase = results.phases[results.phases.length - 1];
        if (lastPhase.exit && lastPhase.exit.reason) {
          let finalStopTime = maxTime;
          const isFinalWeightStop =
            lastPhase.exit.type === 'weight' || lastPhase.exit.type === 'volumetric';
          if (isFinalWeightStop) {
            const lastNonExtendedSample = samples.findLast(
              s => !s.systemInfo?.extendedRecording,
            );
            if (lastNonExtendedSample) {
              finalStopTime = (lastNonExtendedSample.t || 0) / 1000;
            }
          }

          phaseAnnotations.shot_end = {
            type: 'line',
            scaleID: 'x',
            value: finalStopTime,
            borderColor: COLORS.phaseLine,
            borderWidth: 1,
            label: {
              display: visibility.stops,
              content:
                lastPhase.exit.type === 'weight' || lastPhase.exit.type === 'volumetric'
                  ? 'WEIGHT STOP TRIGGERED'
                  : lastPhase.exit.reason.toUpperCase(),
              rotation: -90,
              position: 'start',
              yAdjust: 0,
              xAdjust: -12,
              color: 'rgba(255, 255, 255, 0.95)',
              backgroundColor: COLORS.stopLabel,
              borderRadius: 3,
              padding: 4,
              font: { size: 8, weight: 'bold' },
            },
          };
        }
      }
    }

    if (results && maxTime > 0) {
      phaseAnnotations.brew_mode = {
        type: 'line',
        scaleID: 'x',
        value: maxTime,
        borderColor: 'transparent',
        borderWidth: 0,
        label: {
          display: true,
          content: brewModeLabel,
          rotation: -90,
          position: 'start',
          yAdjust: 0,
          xAdjust: 1,
          color: brewModeLabelTextColor,
          backgroundColor: brewModeColor,
          borderColor: brewModeBorderColor,
          borderWidth: 1,
          borderRadius: 3,
          padding: 4,
          font: { size: 9, weight: 'bold' },
        },
      };
    }

    // Temp chart should only mirror the phase separator lines, without any labels.
    const tempPhaseAnnotations = Object.entries(phaseAnnotations).reduce((acc, [key, annotation]) => {
      const isPhaseSeparator =
        key === 'shot_start' || key === 'shot_end' || key.startsWith('phase_line_');
      if (!isPhaseSeparator) return acc;

      acc[key] = {
        ...annotation,
        label: { display: false },
      };
      return acc;
    }, {});

    const getHoverWaterValuesAtX = xValue => {
      if (!Number.isFinite(xValue) || sampleTimesSec.length === 0) {
        return { totalWaterMl: null, phaseWaterMl: null };
      }

      const sampleIndex = findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue);
      const totalWaterMl = sampleIndex >= 0 ? (cumulativeWaterTotalBySample[sampleIndex] ?? 0) : 0;

      let activePhase = null;
      for (let i = phaseHoverRanges.length - 1; i >= 0; i--) {
        const phaseRange = phaseHoverRanges[i];
        if (xValue >= phaseRange.startAbs && xValue <= phaseRange.endAbs) {
          activePhase = phaseRange;
          break;
        }
      }

      const phaseWaterMl = activePhase
        ? Math.max(0, totalWaterMl - (activePhase.startCumWater ?? 0))
        : null;

      return { totalWaterMl, phaseWaterMl };
    };

    const makeLegendLabel = context => {
      if (context.dataset.label === 'Phase Names' || context.dataset.label === 'Stops') return null;
      const label = context.dataset.label || '';

      if (TOOLTIP_WATER_LABELS.has(label)) {
        const xValue = context.parsed?.x;
        const { totalWaterMl, phaseWaterMl } = getHoverWaterValuesAtX(xValue);
        const waterValue = label === WATER_DRAWN_PHASE_LABEL ? phaseWaterMl : totalWaterMl;
        return `${label}: ${Number.isFinite(waterValue) ? `${waterValue.toFixed(1)} ml` : '-'}`;
      }

      const value = context.parsed?.y;
      if (value === null || value === undefined) return null;
      const unit = UNIT_BY_LABEL[label];
      return unit ? `${label}: ${value.toFixed(1)} ${unit}` : `${label}: ${value.toFixed(1)}`;
    };

    const waterTooltipPhaseSeries = sampleTimesSec.map(x => {
      const { phaseWaterMl } = getHoverWaterValuesAtX(x);
      return { x, y: Number.isFinite(phaseWaterMl) ? phaseWaterMl : 0 };
    });
    const waterTooltipTotalSeries = sampleTimesSec.map((x, index) => ({
      x,
      y: Number.isFinite(cumulativeWaterTotalBySample[index]) ? cumulativeWaterTotalBySample[index] : 0,
    }));

    const tooltipGapBeforeGroup = context => {
      const label = context?.dataset?.label;
      if (!label) return null;

      const tooltipItems = context.tooltip?.dataPoints;
      if (!Array.isArray(tooltipItems) || tooltipItems.length === 0) return null;

      if (TOOLTIP_WATER_LABELS.has(label)) {
        const firstWaterLabel = tooltipItems.find(item => TOOLTIP_WATER_LABELS.has(item?.dataset?.label))
          ?.dataset?.label;
        return firstWaterLabel === label ? [''] : null;
      }

      if (TOOLTIP_BOTTOM_LABELS.has(label)) {
        const firstBottomLabel = tooltipItems.find(item => TOOLTIP_BOTTOM_LABELS.has(item?.dataset?.label))
          ?.dataset?.label;
        return firstBottomLabel === label ? [''] : null;
      }

      return null;
    };

    const tooltipWaterLabelColor = context => {
      const label = context?.dataset?.label;
      if (label === WATER_DRAWN_PHASE_LABEL) {
        return {
          borderColor: COLORS.puckFlow,
          backgroundColor: COLORS.puckFlow,
          borderWidth: 1,
          borderRadius: 2,
        };
      }
      if (label === WATER_DRAWN_TOTAL_LABEL) {
        return {
          borderColor: COLORS.flow,
          backgroundColor: COLORS.flow,
          borderWidth: 1,
          borderRadius: 2,
        };
      }
      return undefined;
    };

    // Main chart datasets:
    // temp/target-temp datasets are tooltip-only proxies on a hidden axis.
    const mainDatasets = [
      {
        label: 'Phase Names',
        data: [],
        borderColor: COLORS.phaseLine,
        backgroundColor: COLORS.phaseLine,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        hidden: !visibility.phaseNames,
      },
      {
        label: 'Stops',
        data: [],
        borderColor: COLORS.stopLabel,
        backgroundColor: COLORS.stopLabel,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        hidden: !visibility.stops,
      },
      {
        label: 'Temp',
        data: series.temp,
        borderColor: COLORS.temp,
        backgroundColor: COLORS.temp,
        yAxisID: 'yTempOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        fill: false,
        hidden: !visibility.temp,
      },
      {
        label: 'Target T',
        data: series.targetTemp,
        borderColor: COLORS.tempTarget,
        backgroundColor: COLORS.tempTarget,
        borderDash: [4, 4],
        yAxisID: 'yTempOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        fill: false,
        hidden: !visibility.targetTemp,
      },
      {
        label: 'Pressure',
        data: series.pressure,
        borderColor: COLORS.pressure,
        backgroundColor: COLORS.pressure,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.pressure,
      },
      {
        label: 'Target P',
        data: series.targetPressure,
        borderColor: COLORS.pressure,
        backgroundColor: targetPressureFill,
        fill: 'origin',
        borderDash: [4, 4],
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0,
        hidden: !visibility.targetPressure,
      },
      {
        label: 'Flow',
        data: series.flow,
        borderColor: COLORS.flow,
        backgroundColor: COLORS.flow,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.flow,
      },
      {
        label: 'Target F',
        data: series.targetFlow,
        borderColor: COLORS.flow,
        backgroundColor: targetFlowFill,
        fill: 'origin',
        borderDash: [4, 4],
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0,
        hidden: !visibility.targetFlow,
      },
      {
        label: 'Puck Flow',
        data: series.puckFlow,
        borderColor: COLORS.puckFlow,
        backgroundColor: COLORS.puckFlow,
        fill: false,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.puckFlow,
      },
      {
        label: 'Weight',
        data: series.weight,
        borderColor: COLORS.weight,
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        fill: 'origin',
        yAxisID: 'yWeight',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0.2,
        hidden: !hasWeight || !visibility.weight,
      },
      {
        label: WATER_DRAWN_PHASE_LABEL,
        data: waterTooltipPhaseSeries,
        borderColor: COLORS.puckFlow,
        backgroundColor: COLORS.puckFlow,
        yAxisID: 'yWaterOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        showLine: false,
        fill: false,
      },
      {
        label: WATER_DRAWN_TOTAL_LABEL,
        data: waterTooltipTotalSeries,
        borderColor: COLORS.flow,
        backgroundColor: COLORS.flow,
        yAxisID: 'yWaterOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        showLine: false,
        fill: false,
      },
    ];

    try {
      mainChartInstance.current = new Chart(mainChartRef.current, {
        type: 'line',
        data: { datasets: mainDatasets },
        plugins: [hoverGuidePlugin, fixedTooltipPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          elements: {
            point: {
              radius: 0,
              hoverRadius: 4,
              hitRadius: 12,
            },
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            fixedTooltip: {
              offsetX: 12,
              offsetY: 0,
              boundsPadding: 4,
              pointerGap: 10,
            },
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              caretSize: 0,
              caretPadding: 0,
              backgroundColor: 'rgba(20, 20, 20, 0.9)',
              titleFont: { size: 12 },
              bodyFont: { size: 11 },
              padding: 8,
              cornerRadius: 4,
              filter: context =>
                context.dataset.label !== 'Phase Names' &&
                context.dataset.label !== 'Stops',
              itemSort: (a, b) =>
                (TOOLTIP_INDEX[a.dataset.label] ?? 999) - (TOOLTIP_INDEX[b.dataset.label] ?? 999),
              callbacks: {
                beforeLabel: tooltipGapBeforeGroup,
                label: makeLegendLabel,
                labelColor: tooltipWaterLabelColor,
              },
            },
            annotation: {
              annotations: phaseAnnotations,
            },
          },
          scales: {
            y: {
              display: false,
              grid: { display: false },
              ticks: { display: false },
            },
            x: {
              type: 'linear',
              display: false,
              max: maxTime,
              ticks: { display: false },
              grid: { display: false },
            },
            yMain: {
              type: 'linear',
              position: 'left',
              min: 0,
              max: mainAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.pressure,
                callback: formatAxisTick,
              },
              grid: {
                color: 'rgba(200, 200, 200, 0.1)',
              },
            },
            yTempOverlay: {
              type: 'linear',
              display: false,
              min: tempAxisMin,
              max: tempAxisMax,
              grid: { display: false },
              ticks: { display: false },
            },
            yWaterOverlay: {
              type: 'linear',
              display: false,
              beginAtZero: true,
              grid: { display: false },
              ticks: { display: false },
            },
            yWeight: {
              type: 'linear',
              display: hasWeight ? 'auto' : false,
              position: 'right',
              offset: false,
              beginAtZero: true,
              min: 0,
              max: weightAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.weight,
                callback: formatAxisTick,
              },
              grid: { display: false },
            },
          },
        },
      });
    } catch (e) {
      console.error('Main chart creation failed:', e);
    }

    const tempDatasets = [
      {
        label: 'Temp',
        data: series.temp,
        borderColor: COLORS.temp,
        backgroundColor: tempToTargetFill,
        fill: visibility.targetTemp ? '+1' : false,
        yAxisID: 'yTemp',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.temp,
      },
      {
        label: 'Target T',
        data: series.targetTemp,
        borderColor: COLORS.tempTarget,
        backgroundColor: COLORS.tempTarget,
        borderDash: [4, 4],
        yAxisID: 'yTempRight',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0,
        hidden: !visibility.targetTemp,
      },
    ];

    try {
      tempChartInstance.current = new Chart(tempChartRef.current, {
        type: 'line',
        data: { datasets: tempDatasets },
        plugins: [hoverGuidePlugin, fixedTooltipPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          layout: {
            padding: { left: 0, right: 0, top: 0, bottom: 0 },
          },
          elements: {
            point: {
              radius: 0,
              hoverRadius: 4,
              hitRadius: 12,
            },
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            fixedTooltip: {
              offsetX: 12,
              offsetY: 2,
              boundsPadding: 4,
            },
            legend: {
              display: false,
            },
            tooltip: {
              enabled: false,
              caretSize: 0,
              caretPadding: 0,
              backgroundColor: 'rgba(20, 20, 20, 0.9)',
              titleFont: { size: 11 },
              bodyFont: { size: 10 },
              padding: 8,
              cornerRadius: 4,
              itemSort: (a, b) =>
                (LEGEND_INDEX[a.dataset.label] ?? 999) - (LEGEND_INDEX[b.dataset.label] ?? 999),
              callbacks: {
                label: makeLegendLabel,
              },
            },
            annotation: {
              annotations: tempPhaseAnnotations,
            },
          },
          scales: {
            x: {
              type: 'linear',
              position: 'top',
              max: maxTime,
              ticks: {
                font: { size: 10 },
                color: '#888',
                callback: formatAxisTick,
                padding: 4,
              },
              grid: {
                display: false,
                drawOnChartArea: false,
              },
              border: {
                display: true,
                color: 'rgba(200, 200, 200, 0.18)',
              },
            },
            yTemp: {
              type: 'linear',
              position: 'left',
              min: tempAxisMin,
              max: tempAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.temp,
                callback: formatAxisTick,
              },
              grid: {
                color: 'rgba(200, 200, 200, 0.1)',
              },
            },
            yTempRight: {
              type: 'linear',
              position: 'right',
              min: targetTempAxisMin,
              max: targetTempAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.tempTarget,
                callback: formatAxisTick,
              },
              grid: { display: false },
            },
          },
        },
      });
    } catch (e) {
      console.error('Temp chart creation failed:', e);
    }

    const syncTempPlotArea = () => {
      const mainChart = mainChartInstance.current;
      const tempChart = tempChartInstance.current;
      if (!mainChart || !tempChart || !mainChart.chartArea || !tempChart.chartArea) return;

      const mainLeftMargin = mainChart.chartArea.left;
      const mainRightMargin = mainChart.width - mainChart.chartArea.right;
      const tempLeftMargin = tempChart.chartArea.left;
      const tempRightMargin = tempChart.width - tempChart.chartArea.right;

      const leftPadding = Math.max(0, mainLeftMargin - tempLeftMargin);
      const rightPadding = Math.max(0, mainRightMargin - tempRightMargin);

      const currentPadding = tempChart.options.layout?.padding || {};
      const currentLeft = Number(currentPadding.left) || 0;
      const currentRight = Number(currentPadding.right) || 0;

      if (Math.abs(currentLeft - leftPadding) < 0.5 && Math.abs(currentRight - rightPadding) < 0.5) {
        return;
      }

      tempChart.options.layout = tempChart.options.layout || {};
      tempChart.options.layout.padding = {
        left: leftPadding,
        right: rightPadding,
        top: 0,
        bottom: 0,
      };
      tempChart.update('none');
    };

    // Two quick passes help settle chartArea measurements after initial layout.
    const syncTempPlotAreaTwice = () => {
      syncTempPlotArea();
      syncTempPlotArea();
    };
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(syncTempPlotAreaTwice);
    } else {
      syncTempPlotAreaTwice();
    }

    const handleResizeSync = () => {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(syncTempPlotAreaTwice);
      } else {
        syncTempPlotAreaTwice();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResizeSync);
    }

    const clearTooltipState = chart => {
      if (!chart) return;
      chart.$fixedTooltipPointerY = null;
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      chart.update('none');
    };

    const findClosestPointIndex = (datasetData, xValue) => {
      if (!Array.isArray(datasetData) || datasetData.length === 0) return -1;
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < datasetData.length; i++) {
        const point = datasetData[i];
        if (!point || typeof point.x !== 'number') continue;
        const distance = Math.abs(point.x - xValue);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      return bestIndex;
    };

    const buildActiveElementsForX = (chart, xValue) => {
      const active = [];
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden || dataset.hidden) return;
        const index = findClosestPointIndex(dataset.data, xValue);
        if (index >= 0) active.push({ datasetIndex, index });
      });
      return active;
    };

    const applyHoverForChart = (chart, xValue, pointerClientY, showTooltip = true) => {
      if (!chart || !Number.isFinite(xValue)) return;
      const active = buildActiveElementsForX(chart, xValue);
      if (!active.length) {
        clearTooltipState(chart);
        return;
      }
      const xPixel = chart.scales?.x?.getPixelForValue(xValue);
      const tooltipX = Number.isFinite(xPixel) ? xPixel : chart.chartArea.left + 8;
      let tooltipY = chart.chartArea.top + 8;
      if (Number.isFinite(pointerClientY) && chart.canvas) {
        const chartRect = chart.canvas.getBoundingClientRect();
        const minClientY = chartRect.top + chart.chartArea.top;
        const maxClientY = chartRect.top + chart.chartArea.bottom;
        const clampedClientY = Math.min(maxClientY, Math.max(minClientY, pointerClientY));
        tooltipY = clampedClientY - chartRect.top;
      }
      chart.$fixedTooltipPointerY = tooltipY;
      chart.setActiveElements(active);
      if (showTooltip) {
        chart.tooltip?.setActiveElements(active, { x: tooltipX, y: tooltipY });
      } else {
        chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      }
      chart.update('none');
    };

    const clearAllHover = () => {
      clearTooltipState(mainChartInstance.current);
      clearTooltipState(tempChartInstance.current);
    };

    const extractClientPoint = event => {
      if (!event) return null;
      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        return { clientX: event.clientX, clientY: event.clientY };
      }
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
        return { clientX: touch.clientX, clientY: touch.clientY };
      }
      return null;
    };

    const applyUnifiedHoverFromClientPoint = (clientX, clientY) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const mainChart = mainChartInstance.current;
      const tempChart = tempChartInstance.current;
      const hoverArea = hoverAreaRef.current;
      if (!mainChart || !tempChart || !hoverArea) return;

      const mainXScale = mainChart.scales?.x;
      if (!mainXScale || !mainChart.canvas) return;

      const areaRect = hoverArea.getBoundingClientRect();
      const verticalTolerance = 20;
      const withinVerticalTolerance =
        clientY >= areaRect.top - verticalTolerance &&
        clientY <= areaRect.bottom + verticalTolerance;
      if (!withinVerticalTolerance) {
        clearAllHover();
        return;
      }

      const mainRect = mainChart.canvas.getBoundingClientRect();
      const minClientX = mainRect.left + (mainChart.chartArea?.left || 0);
      const maxClientX = mainRect.left + (mainChart.chartArea?.right || mainChart.width || 0);
      const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
      const sourceX = clampedClientX - mainRect.left;
      const xValue = mainXScale.getValueForPixel(sourceX);
      if (!Number.isFinite(xValue)) {
        clearAllHover();
        return;
      }

      applyHoverForChart(mainChart, xValue, clientY, true);
      applyHoverForChart(tempChart, xValue, clientY, false);
    };

    const handleUnifiedMove = event => {
      const point = extractClientPoint(event);
      if (!point) return;
      applyUnifiedHoverFromClientPoint(point.clientX, point.clientY);
    };

    const hoverArea = hoverAreaRef.current;
    const supportsPointerEvents = typeof window !== 'undefined' && Boolean(window.PointerEvent);
    if (supportsPointerEvents) {
      hoverArea?.addEventListener('pointerdown', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('pointermove', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('pointerup', clearAllHover);
      hoverArea?.addEventListener('pointerleave', clearAllHover);
      hoverArea?.addEventListener('pointercancel', clearAllHover);
    } else {
      hoverArea?.addEventListener('mousemove', handleUnifiedMove);
      hoverArea?.addEventListener('mouseleave', clearAllHover);
      hoverArea?.addEventListener('touchstart', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('touchmove', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('touchend', clearAllHover);
      hoverArea?.addEventListener('touchcancel', clearAllHover);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResizeSync);
      }
      if (supportsPointerEvents) {
        hoverArea?.removeEventListener('pointerdown', handleUnifiedMove);
        hoverArea?.removeEventListener('pointermove', handleUnifiedMove);
        hoverArea?.removeEventListener('pointerup', clearAllHover);
        hoverArea?.removeEventListener('pointerleave', clearAllHover);
        hoverArea?.removeEventListener('pointercancel', clearAllHover);
      } else {
        hoverArea?.removeEventListener('mousemove', handleUnifiedMove);
        hoverArea?.removeEventListener('mouseleave', clearAllHover);
        hoverArea?.removeEventListener('touchstart', handleUnifiedMove);
        hoverArea?.removeEventListener('touchmove', handleUnifiedMove);
        hoverArea?.removeEventListener('touchend', clearAllHover);
        hoverArea?.removeEventListener('touchcancel', clearAllHover);
      }
      destroyCharts();
    };
  }, [shotData, results, visibility]);

  // Render nothing if no data
  if (!shotData || !shotData.samples || shotData.samples.length === 0) {
    return null;
  }

  return (
    <div className='w-full select-none'>
      <div className='mb-2 flex flex-wrap items-center gap-2 px-1'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1'>
          {LEGEND_ORDER.map(label => {
            if (label === 'Weight' && !hasWeightData) return null;
            const key = VISIBILITY_KEY_BY_LABEL[label];
            const isVisible = key ? visibility[key] : false;
            const swatchColor = legendColorByLabel[label] || '#94a3b8';
            const swatchLineWidth = LEGEND_THIN_LINE_LABELS.has(label)
              ? THIN_LINE_WIDTH
              : STANDARD_LINE_WIDTH;

            return (
              <button
                key={label}
                type='button'
                onClick={() => handleLegendToggle(label)}
                aria-pressed={isVisible}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-[10px] font-semibold transition ${
                  isVisible ? 'text-base-content opacity-90' : 'text-base-content/60 opacity-45 hover:opacity-70'
                }`}
              >
                {LEGEND_BLOCK_LABELS.has(label) ? (
                  <span className='h-2.5 w-3 rounded-[2px]' style={{ backgroundColor: swatchColor }} />
                ) : (
                  <span
                    className={`block w-4 border-t ${LEGEND_DASHED_LABELS.has(label) ? 'border-dashed' : 'border-solid'}`}
                    style={{ borderColor: swatchColor, borderTopWidth: `${swatchLineWidth}px` }}
                  />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className='flex shrink-0 items-center'>
          <button
            type='button'
            onClick={() =>
              setMainChartHeight(current =>
                current === MAIN_CHART_HEIGHT_SMALL ? MAIN_CHART_HEIGHT_BIG : MAIN_CHART_HEIGHT_SMALL,
              )
            }
            className='btn btn-ghost btn-xs h-7 min-h-0 w-7 p-0'
            aria-label={mainChartHeight === MAIN_CHART_HEIGHT_BIG ? 'Minimize chart' : 'Maximize chart'}
            title={mainChartHeight === MAIN_CHART_HEIGHT_BIG ? 'Minimize chart' : 'Maximize chart'}
          >
            <FontAwesomeIcon
              icon={mainChartHeight === MAIN_CHART_HEIGHT_BIG ? faMinimize : faMaximize}
              className='text-[11px] opacity-80'
            />
          </button>
        </div>
      </div>

      <div ref={hoverAreaRef} className='w-full'>
        <div className='relative w-full' style={{ height: `${mainChartHeight}px` }}>
          <canvas ref={mainChartRef} />
        </div>
        <div
          className='relative mt-0 w-full'
          style={{ height: `${Math.round(mainChartHeight * TEMP_CHART_HEIGHT_RATIO)}px` }}
        >
          <canvas ref={tempChartRef} />
        </div>
      </div>
    </div>
  );
}
