// Sub-components for the Statistics view detail section: header bar and panel body with metrics, profile groups, phase stats, trend chart, and compare
import { STATISTICS_PANEL_CLASS } from './constants';
import { StatisticsShotCompareSection } from '../StatisticsShotCompareSection';
import { MetricsTable } from '../MetricsTable';
import { ProfileGroupTable } from '../ProfileGroupTable';
import { PhaseStatistics } from '../PhaseStatistics';
import { TrendChart } from '../TrendChart';
import { ActivityHeatmap } from '../ActivityHeatmap';

const STATISTICS_SECTION_TITLE_CLASS = 'text-xs font-semibold uppercase tracking-widest opacity-90';

function StatisticsDetailHeader({
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  setStatisticsDetailSection,
}) {
  const availableTabs = [
    hasMetricStatistics ? { id: 'metrics', label: 'Global metric averages' } : null,
    hasTrendStatistics ? { id: 'trends', label: 'Trends' } : null,
    hasCompareStatistics ? { id: 'compare', label: 'Shot Charts' } : null,
    hasProfileGroupStatistics ? { id: 'profile', label: 'Per-profile statistics' } : null,
    hasPhaseStatistics ? { id: 'phase', label: 'Per-phase statistics' } : null,
  ].filter(Boolean);

  if (availableTabs.length > 1) {
    return (
      <div role='tablist' className='tabs tabs-border'>
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            className={`tab ${resolvedStatisticsDetailSection === tab.id ? 'tab-active' : ''}`}
            aria-selected={resolvedStatisticsDetailSection === tab.id}
            onClick={() => setStatisticsDetailSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  const title = availableTabs[0]?.label || 'Statistics';
  return <h3 className={STATISTICS_SECTION_TITLE_CLASS}>{title}</h3>;
}

export function StatisticsDetailSectionPanel({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  result,
  setStatisticsDetailSection,
  hidePhaseExitReasons = false,
  chartRunKey = 'idle',
}) {
  const hasCompareStatistics = Array.isArray(compareEntries) && compareEntries.length > 0;

  if (
    !hasCompareStatistics &&
    !hasMetricStatistics &&
    !hasTrendStatistics &&
    !hasProfileGroupStatistics &&
    !hasPhaseStatistics
  ) {
    return null;
  }

  const shouldUsePanelSurface =
    resolvedStatisticsDetailSection !== 'metrics' &&
    resolvedStatisticsDetailSection !== 'compare' &&
    resolvedStatisticsDetailSection !== 'phase';
  const shouldUseCompactChartPadding = resolvedStatisticsDetailSection === 'trends';

  const sectionContent = (
    <>
      {hasCompareStatistics && resolvedStatisticsDetailSection === 'compare' && (
        <StatisticsShotCompareSection
          key={`statistics-shot-charts-${chartRunKey}`}
          compareEntries={compareEntries}
          compareTargetDisplayMode={compareTargetDisplayMode}
          onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
          showTitle={false}
          embedded={true}
        />
      )}

      {hasMetricStatistics && resolvedStatisticsDetailSection === 'metrics' && (
        <MetricsTable metrics={result.metrics} />
      )}

      {hasTrendStatistics && resolvedStatisticsDetailSection === 'trends' && (
        <div className='space-y-4'>
          <TrendChart key={`statistics-trends-${chartRunKey}`} trends={result.trends} />
          <ActivityHeatmap trends={result.trends} />
        </div>
      )}

      {hasProfileGroupStatistics && resolvedStatisticsDetailSection === 'profile' && (
        <ProfileGroupTable profileGroups={result.profileGroups} showTitle={false} />
      )}

      {hasPhaseStatistics && resolvedStatisticsDetailSection === 'phase' && (
        <PhaseStatistics
          phaseStats={result.phaseStats}
          showTitle={false}
          hideExitReasons={hidePhaseExitReasons}
        />
      )}
    </>
  );

  return (
    <div className='space-y-2'>
      <StatisticsDetailHeader
        hasCompareStatistics={hasCompareStatistics}
        hasMetricStatistics={hasMetricStatistics}
        hasTrendStatistics={hasTrendStatistics}
        hasPhaseStatistics={hasPhaseStatistics}
        hasProfileGroupStatistics={hasProfileGroupStatistics}
        resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
        setStatisticsDetailSection={setStatisticsDetailSection}
      />
      {shouldUsePanelSurface ? (
        <div
          className={`${STATISTICS_PANEL_CLASS} ${
            shouldUseCompactChartPadding ? 'px-1.5 py-2 sm:px-2' : 'p-4'
          }`}
        >
          {sectionContent}
        </div>
      ) : (
        sectionContent
      )}
    </div>
  );
}
