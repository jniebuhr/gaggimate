import { resolveShotEffectiveTimestampMs } from './statisticsSearchDsl';

export const STATISTICS_CHART_SHOT_LIMIT = 100;

export function getLatestStatisticsChartEntries(entries) {
  return entries
    .filter(entry =>
      entry.shotData?.brewKind !== 'manual' &&
      entry.analysis?.brewKind !== 'manual' &&
      entry.meta?.brewKind !== 'manual',
    )
    .map(entry => ({
      entry,
      timestamp: resolveShotEffectiveTimestampMs({ ...entry.meta, ...entry.shotData }) || 0,
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, STATISTICS_CHART_SHOT_LIMIT)
    .map(({ entry }) => entry);
}
