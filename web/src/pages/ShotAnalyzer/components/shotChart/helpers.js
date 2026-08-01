/**
 * Stable public entry point for low-level ShotChart helpers.
 * Implementations are grouped by responsibility under ./helpers/.
 */

export {
  getNeutralAxisTickColor,
  getAxisUnitReservedPadding,
  axisUnitLabelPlugin,
  phaseLabelOverlayPlugin,
} from './helpers/axisPlugins';

export {
  hoverGuidePlugin,
  finalWeightCalloutLinePlugin,
  phaseBackgroundOverlayPlugin,
  stopIconOverlayPlugin,
  finalWeightBadgeOverlayPlugin,
} from './helpers/overlayPlugins';

export { replayRevealPlugin, buildShotChartReplayModel } from './helpers/chartReplay';

export {
  readCssColorVar,
  getShotChartColors,
  getLegendColorByLabel,
  getTooltipColorByLabel,
  createStripedFillPattern,
} from './helpers/chartTheme';

export {
  getPercentileValue,
  getSpikeResistantSeriesMax,
  formatUniqueAxisTick,
  formatResponsiveXAxisTick,
} from './helpers/chartScale';

export {
  getVisibleLegendItemsForExport,
  buildReplayExportFilename,
  buildReplayImageFilename,
} from './helpers/chartExport';

export {
  resolveHoverPointColor,
  createChartPointElementConfig,
  computeExternalTooltipPosition,
} from './helpers/chartInteraction';

export {
  getPhaseName,
  toNumberOrNull,
  safeMax,
  safeMin,
  findLastSampleIndexAtOrBeforeX,
} from './helpers/chartData';
