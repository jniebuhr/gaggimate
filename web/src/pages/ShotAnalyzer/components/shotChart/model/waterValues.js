import { findLastSampleIndexAtOrBeforeX } from '../helpers';

export function buildPhaseHoverRanges(
  results,
  shotStartSec,
  sampleTimesSec,
  cumulativeWaterTotalBySample,
) {
  if (!Array.isArray(results?.phases)) return [];

  // Cache absolute phase windows once so hover lookups can resolve "phase water"
  // with cheap arithmetic instead of rescanning phase metadata on every pointer move.
  return results.phases
    .map(phase => {
      const startRel = Number(phase?.start);
      if (!Number.isFinite(startRel)) return null;

      const endRelRaw = Number(phase?.end);
      const endRel = Number.isFinite(endRelRaw) ? endRelRaw : startRel;
      const startAbs = shotStartSec + startRel;
      const endAbs = shotStartSec + Math.max(startRel, endRel);
      const startSampleIndexFloor = findLastSampleIndexAtOrBeforeX(sampleTimesSec, startAbs);

      return {
        label: phase?.displayName || phase?.name || null,
        startAbs,
        endAbs,
        startCumWater:
          startSampleIndexFloor >= 0 ? cumulativeWaterTotalBySample[startSampleIndexFloor] || 0 : 0,
      };
    })
    .filter(Boolean);
}

export function createHoverWaterValueGetter({
  phaseHoverRanges,
  sampleTimesSec,
  cumulativeWaterTotalBySample,
}) {
  return xValue => {
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

    return {
      totalWaterMl,
      phaseWaterMl: activePhase
        ? Math.max(0, totalWaterMl - (activePhase.startCumWater ?? 0))
        : null,
    };
  };
}

export function buildWaterTooltipSeries(
  sampleTimesSec,
  cumulativeWaterTotalBySample,
  getHoverWaterValuesAtX,
) {
  return {
    // These hidden overlay datasets exist only so Chart.js can expose water values
    // through the shared tooltip pipeline without drawing extra visible series.
    waterTooltipPhaseSeries: sampleTimesSec.map(x => {
      const { phaseWaterMl } = getHoverWaterValuesAtX(x);
      return { x, y: Number.isFinite(phaseWaterMl) ? phaseWaterMl : 0 };
    }),
    waterTooltipTotalSeries: sampleTimesSec.map((x, index) => ({
      x,
      y: Number.isFinite(cumulativeWaterTotalBySample[index])
        ? cumulativeWaterTotalBySample[index]
        : 0,
    })),
  };
}
