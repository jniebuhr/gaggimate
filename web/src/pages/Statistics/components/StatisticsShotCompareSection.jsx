import { CompareShotCharts } from '../../ShotAnalyzer/components/shotChart/CompareShotCharts';
import { STATISTICS_SECTION_TITLE_CLASS } from './statisticsUi';

const STATISTICS_COMPARE_PANEL_CLASS =
  'bg-base-100 border-base-content/10 rounded-xl border shadow-sm';

export function StatisticsShotCompareSection({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  showTitle = true,
  embedded = false,
}) {
  if (!Array.isArray(compareEntries) || compareEntries.length === 0) return null;

  const content = (
    <CompareShotCharts
      compareEntries={compareEntries}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
      showPhaseAnnotations={false}
      showStopAnnotations={false}
      showBrewModeAnnotation={false}
      showCompareAnnotationToggle={false}
      enableDualMainChartAnnotations={false}
      showMainChartTitle={false}
      detailChartTitleVariant='legend'
      enableHoverInfo={true}
      compareTooltipMode='compareTitleOnly'
      showCompareShotLegend={false}
      shotStylePreset='statistics'
      showWeightInMainChart={false}
      showWeightFlowInMainChart={false}
    />
  );

  if (embedded) {
    return (
      <div className='space-y-2'>
        {showTitle && <h3 className={STATISTICS_SECTION_TITLE_CLASS}>Shot Charts</h3>}
        {content}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {showTitle && <h3 className={STATISTICS_SECTION_TITLE_CLASS}>Shot Charts</h3>}

      <div className={`${STATISTICS_COMPARE_PANEL_CLASS} p-4`}>{content}</div>
    </div>
  );
}
