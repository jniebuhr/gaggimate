/** Public chart entry point that selects the single-shot or compare implementation. */

import { CompareShotCharts } from './shotChart/CompareShotCharts';
import { SingleShotChart } from './shotChart/single/SingleShotChart';
import './ShotChart.css';

export function ShotChart({
  shotData,
  results,
  compareEntries = [],
  isCompareActive = false,
  desktopCardHeight = 0,
  onCompareSwap = null,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
}) {
  if (isCompareActive && Array.isArray(compareEntries) && compareEntries.length > 1) {
    return (
      <CompareShotCharts
        compareEntries={compareEntries}
        onCompareSwap={onCompareSwap}
        compareTargetDisplayMode={compareTargetDisplayMode}
        onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        showMainChartTitle={false}
        detailChartTitleVariant='legend'
      />
    );
  }

  return (
    <SingleShotChart shotData={shotData} results={results} desktopCardHeight={desktopCardHeight} />
  );
}
