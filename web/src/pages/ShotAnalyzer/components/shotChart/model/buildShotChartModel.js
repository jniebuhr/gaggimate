/**
 * buildShotChartModel.js
 *
 * Translates raw shot samples + analyzer results into the normalized model used
 * by Chart.js config builders, hover helpers, and replay preparation.
 */

import { buildAxisRanges, buildSampleTimeline, buildSeries } from './chartSeries';
import {
  buildPhaseAnnotations,
  buildPhaseOverviewRows,
  buildTempPhaseAnnotations,
  getExtendedRecordingStartX,
} from './phaseAnnotations';
import {
  buildPhaseHoverRanges,
  buildWaterTooltipSeries,
  createHoverWaterValueGetter,
} from './waterValues';

export function buildShotChartModel({
  shotData,
  results,
  visibility,
  colors,
  brewModeMeta,
  usePhaseNumbers,
}) {
  const samples = Array.isArray(shotData?.samples) ? shotData.samples : [];
  const { maxTime, shotStartSec, sampleTimesSec, cumulativeWaterTotalBySample } =
    buildSampleTimeline(samples);
  const phaseHoverRanges = buildPhaseHoverRanges(
    results,
    shotStartSec,
    sampleTimesSec,
    cumulativeWaterTotalBySample,
  );
  const series = buildSeries(samples);
  const { hasWeight, mainAxisMax, weightAxisMax, tempAxisMin, tempAxisMax } =
    buildAxisRanges(series);
  const phaseLabelOverlays = [];
  const phaseBackgroundRanges = [];
  const extendedStartX = getExtendedRecordingStartX(samples, maxTime);
  const stopIconOverlays = [];
  const phaseAnnotations = buildPhaseAnnotations({
    shotData,
    results,
    samples,
    maxTime,
    colors,
    visibility,
    usePhaseNumbers,
    phaseLabelOverlays,
    phaseBackgroundRanges,
    extendedStartX,
    stopIconOverlays,
  });
  const tempPhaseAnnotations = buildTempPhaseAnnotations(phaseAnnotations);
  const phaseOverviewRows = buildPhaseOverviewRows({ shotData, results });
  const getHoverWaterValuesAtX = createHoverWaterValueGetter({
    phaseHoverRanges,
    sampleTimesSec,
    cumulativeWaterTotalBySample,
  });
  const { waterTooltipPhaseSeries, waterTooltipTotalSeries } = buildWaterTooltipSeries(
    sampleTimesSec,
    cumulativeWaterTotalBySample,
    getHoverWaterValuesAtX,
  );

  // Return one normalized model so chart config, replay preparation, hover, and
  // export logic all operate on the same already-parsed representation.
  return {
    maxTime,
    shotStartSec,
    sampleTimesSec,
    series,
    hasWeight,
    mainAxisMax,
    weightAxisMax,
    tempAxisMin,
    tempAxisMax,
    phaseAnnotations,
    tempPhaseAnnotations,
    phaseLabelOverlays,
    phaseBackgroundRanges,
    stopIconOverlays,
    phaseOverviewRows,
    getHoverWaterValuesAtX,
    waterTooltipPhaseSeries,
    waterTooltipTotalSeries,
    brewLabel: brewModeMeta?.label || null,
    brewIconDef: brewModeMeta?.iconDef || null,
  };
}
